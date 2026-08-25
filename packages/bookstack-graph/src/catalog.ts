import type { AgentSpecFrontmatter } from "@spec-hub/shared-schemas";
import {
  normalizeContractId,
  safeParseAgentSpecMarkdown,
} from "@spec-hub/shared-schemas";

export type SyncedSpecPage = {
  taskId: string;
  relativePath: string;
  frontmatter: AgentSpecFrontmatter;
  body: string;
  markdown: string;
};

export type PublishesCatalogBuild = {
  publishes: Set<string>;
  byTask: Map<string, SyncedSpecPage>;
  parseErrors: Array<{ path: string; message: string }>;
};

/** Collect publishes across synced Agent-Ready markdown pages. */
export function buildPublishesCatalog(
  pages: Array<{ relativePath: string; markdown: string }>,
): PublishesCatalogBuild {
  const publishes = new Set<string>();
  const byTask = new Map<string, SyncedSpecPage>();
  const parseErrors: Array<{ path: string; message: string }> = [];

  for (const page of pages) {
    const parsed = safeParseAgentSpecMarkdown(page.markdown);
    if (!parsed.success) {
      parseErrors.push({
        path: page.relativePath,
        message: parsed.error.issues.map((i) => i.message).join("; "),
      });
      continue;
    }

    const doc = parsed.data;
    for (const raw of doc.frontmatter.publishes ?? []) {
      publishes.add(normalizeContractId(raw));
    }

    const entry: SyncedSpecPage = {
      taskId: doc.frontmatter.task_id,
      relativePath: page.relativePath,
      frontmatter: doc.frontmatter,
      body: doc.body,
      markdown: page.markdown,
    };
    byTask.set(doc.frontmatter.task_id, entry);
  }

  return { publishes, byTask, parseErrors };
}
