import fs from "node:fs/promises";
import path from "node:path";
import { assertConsumesResolved } from "@spec-hub/codex-gate";
import { buildPublishesCatalog } from "./catalog.js";
import {
  defaultCorpusDir,
  defaultFixturesDir,
  syncManifestPath,
} from "./paths.js";

export type SyncOptions = {
  source?: "fixtures" | "api";
  fixturesDir?: string;
  corpusDir?: string;
  /** When syncing from API, injected page markdown fetch results. */
  apiPages?: Array<{
    shelf: string;
    book: string;
    name: string;
    markdown: string;
    updatedAt?: string;
  }>;
};

export type SyncResult = {
  corpusDir: string;
  pageCount: number;
  publishes: string[];
  gateFindings: Array<{
    taskId: string;
    ok: boolean;
    findings: Array<{ code: string; severity: string; message: string }>;
  }>;
  rejected: Array<{ taskId: string; reason: string }>;
  parseErrors: Array<{ path: string; message: string }>;
};

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function listMarkdownFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  async function walk(current: string) {
    let entries;
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name.startsWith(".")) continue;
        await walk(full);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        out.push(full);
      }
    }
  }
  await walk(dir);
  return out;
}

/**
 * Sync BookStack (or local fixtures) into data/bookstack-corpus.
 * Builds publishes catalog and runs consume integrity gate.
 */
export async function syncBookstackCorpus(
  options: SyncOptions = {},
): Promise<SyncResult> {
  const corpusDir = options.corpusDir ?? defaultCorpusDir();
  const source = options.source ?? (options.apiPages ? "api" : "fixtures");
  const fixturesDir = options.fixturesDir ?? defaultFixturesDir();

  await fs.rm(corpusDir, { recursive: true, force: true });
  await fs.mkdir(corpusDir, { recursive: true });

  const written: Array<{ relativePath: string; markdown: string }> = [];

  if (source === "fixtures") {
    const files = await listMarkdownFiles(fixturesDir);
    if (files.length === 0) {
      throw new Error(
        `Fixture corpus empty at ${fixturesDir}. Add Agent-Ready markdown fixtures or configure BookStack API tokens.`,
      );
    }
    for (const file of files) {
      const markdown = await fs.readFile(file, "utf8");
      const relFromFixtures = path.relative(fixturesDir, file);
      const dest = path.join(corpusDir, relFromFixtures);
      await fs.mkdir(path.dirname(dest), { recursive: true });
      await fs.writeFile(dest, markdown, "utf8");
      written.push({
        relativePath: relFromFixtures.replace(/\\/g, "/"),
        markdown,
      });
    }
  } else {
    const pages = options.apiPages ?? [];
    if (pages.length === 0) {
      throw new Error(
        "BookStack wiki sync returned no pages (empty). Seed content or use --fixtures.",
      );
    }
    for (const page of pages) {
      const rel = path.join(
        "shelves",
        slugify(page.shelf),
        "books",
        slugify(page.book),
        `${slugify(page.name)}.md`,
      );
      const dest = path.join(corpusDir, rel);
      await fs.mkdir(path.dirname(dest), { recursive: true });
      await fs.writeFile(dest, page.markdown, "utf8");
      written.push({ relativePath: rel.replace(/\\/g, "/"), markdown: page.markdown });
    }
  }

  const catalog = buildPublishesCatalog(written);
  const gateFindings: SyncResult["gateFindings"] = [];
  const rejected: SyncResult["rejected"] = [];

  for (const page of catalog.byTask.values()) {
    const gate = assertConsumesResolved(page.frontmatter, {
      publishes: catalog.publishes,
    });
    gateFindings.push({
      taskId: page.taskId,
      ok: gate.ok,
      findings: gate.findings,
    });
    if (!gate.ok) {
      rejected.push({
        taskId: page.taskId,
        reason: gate.findings
          .filter((f) => f.severity === "error")
          .map((f) => f.message)
          .join("; "),
      });
    }
  }

  const manifest = {
    syncedAt: new Date().toISOString(),
    source,
    pageCount: written.length,
    publishes: [...catalog.publishes].sort(),
    rejected: rejected.map((r) => r.taskId),
    parseErrors: catalog.parseErrors,
  };
  await fs.writeFile(
    syncManifestPath(corpusDir),
    JSON.stringify(manifest, null, 2),
    "utf8",
  );

  return {
    corpusDir,
    pageCount: written.length,
    publishes: [...catalog.publishes].sort(),
    gateFindings,
    rejected,
    parseErrors: catalog.parseErrors,
  };
}
