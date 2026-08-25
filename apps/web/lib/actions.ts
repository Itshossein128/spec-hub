"use server";

import fs from "node:fs/promises";
import path from "node:path";
import type { SpecFormData } from "@spec-hub/shared-schemas";
import { SpecFormSchema } from "@spec-hub/shared-schemas";
import {
  createBookStackClient,
  hasBookStackConfig,
  type BookStackBook,
  type BookStackShelf,
} from "./bookstack";
import { loadMonorepoEnv, monorepoRoot } from "./env";
import {
  ensureTaskId,
  mapFormToMarkdown,
  tagsFromBookStack,
  type SpecStatus,
} from "./map-form-to-markdown";
import {
  oneSentenceDescription,
  upsertMasterIndexEntry,
} from "./master-index";
import { evaluateSpecGate, type GateResult } from "./run-gate";

loadMonorepoEnv();

export type BookStackStatus = {
  configured: boolean;
  baseUrl: string | null;
};

export type PlacementOption = { id: number; name: string };

export async function getBookStackStatus(): Promise<BookStackStatus> {
  const configured = hasBookStackConfig();
  const baseUrl = (
    process.env.BOOKSTACK_URL ||
    process.env.BOOKSTACK_APP_URL ||
    ""
  ).replace(/\/$/, "");
  return { configured, baseUrl: baseUrl || null };
}

export async function listBookStackPlacement(): Promise<{
  configured: boolean;
  shelves: BookStackShelf[];
  books: BookStackBook[];
  error?: string;
}> {
  if (!hasBookStackConfig()) {
    return { configured: false, shelves: [], books: [] };
  }
  try {
    const client = createBookStackClient();
    const [shelves, books] = await Promise.all([
      client.listShelves(),
      client.listBooks(),
    ]);
    return {
      configured: true,
      shelves: shelves.data,
      books: books.data,
    };
  } catch (err) {
    return {
      configured: true,
      shelves: [],
      books: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function listChaptersForBookAction(
  bookId: number,
): Promise<{ chapters: PlacementOption[]; error?: string }> {
  if (!hasBookStackConfig() || !bookId) {
    return { chapters: [] };
  }
  try {
    const client = createBookStackClient();
    const res = await client.listChapters(bookId);
    return {
      chapters: res.data.map((c) => ({ id: c.id, name: c.name })),
    };
  } catch (err) {
    return {
      chapters: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export type EnsureEntityResult =
  | { ok: true; id: number; name: string; created: boolean }
  | { ok: false; error: string };

/** Find shelf by name (case-insensitive) or create it. */
export async function ensureShelfAction(name: string): Promise<EnsureEntityResult> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "نام قفسه خالی است." };
  if (!hasBookStackConfig()) {
    return { ok: true, id: 0, name: trimmed, created: false };
  }
  try {
    const client = createBookStackClient();
    const listed = await client.listShelves(200);
    const existing = listed.data.find(
      (s) => s.name.trim().toLowerCase() === trimmed.toLowerCase(),
    );
    if (existing) {
      return { ok: true, id: existing.id, name: existing.name, created: false };
    }
    const created = await client.createShelf({ name: trimmed });
    return { ok: true, id: created.id, name: created.name, created: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Find/create book; optionally attach to shelf. */
export async function ensureBookAction(input: {
  name: string;
  shelfId?: number;
}): Promise<EnsureEntityResult> {
  const trimmed = input.name.trim();
  if (!trimmed) return { ok: false, error: "نام کتاب خالی است." };
  if (!hasBookStackConfig()) {
    return { ok: true, id: 0, name: trimmed, created: false };
  }
  try {
    const client = createBookStackClient();
    const listed = await client.listBooks(200);
    let book = listed.data.find(
      (b) => b.name.trim().toLowerCase() === trimmed.toLowerCase(),
    );
    let created = false;
    if (!book) {
      book = await client.createBook({ name: trimmed });
      created = true;
    }
    if (input.shelfId && input.shelfId > 0) {
      const shelf = await client.getShelf(input.shelfId);
      const bookIds = (shelf.books ?? []).map((b) => b.id);
      if (!bookIds.includes(book.id)) {
        await client.updateShelf(input.shelfId, {
          books: [...bookIds, book.id],
        });
      }
    }
    return { ok: true, id: book.id, name: book.name, created };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Find/create chapter under a book. */
export async function ensureChapterAction(input: {
  name: string;
  bookId: number;
}): Promise<EnsureEntityResult> {
  const trimmed = input.name.trim();
  if (!trimmed) return { ok: false, error: "نام فصل خالی است." };
  if (!input.bookId) {
    return { ok: false, error: "ابتدا کتاب را انتخاب یا ایجاد کنید." };
  }
  if (!hasBookStackConfig()) {
    return { ok: true, id: 0, name: trimmed, created: false };
  }
  try {
    const client = createBookStackClient();
    const listed = await client.listChapters(input.bookId, 200);
    const existing = listed.data.find(
      (c) => c.name.trim().toLowerCase() === trimmed.toLowerCase(),
    );
    if (existing) {
      return { ok: true, id: existing.id, name: existing.name, created: false };
    }
    const created = await client.createChapter({
      book_id: input.bookId,
      name: trimmed,
    });
    await upsertMasterIndexEntry(client, {
      bookId: input.bookId,
      entryTitle: created.name,
      entryEntityId: created.id,
      description: oneSentenceDescription(
        `Chapter (module/entity) for ${created.name}`,
        `Module chapter: ${created.name}`,
      ),
    });
    return { ok: true, id: created.id, name: created.name, created: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Collect publishes contract IDs from synced corpus + optional live BookStack. */
export async function loadPublishesCatalog(): Promise<string[]> {
  const publishes = new Set<string>();
  const root = monorepoRoot();
  const roots = [
    path.join(root, "data/bookstack-corpus"),
    path.join(root, "packages/bookstack-graph/fixtures"),
  ];

  for (const dir of roots) {
    try {
      await walkMarkdown(dir, async (file) => {
        const text = await fs.readFile(file, "utf8");
        for (const id of extractPublishes(text)) publishes.add(id);
      });
    } catch {
      // directory may not exist
    }
  }

  return [...publishes];
}

function extractPublishes(markdown: string): string[] {
  const ids: string[] = [];
  const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(markdown);
  if (!fm?.[1]) return ids;
  const block = fm[1];
  const section = /publishes:\s*\n((?:[ \t]*-[ \t]*.+\n?)*)/i.exec(block);
  if (!section?.[1]) return ids;
  for (const line of section[1].split("\n")) {
    const m = /^\s*-\s*"?([^"\n]+)"?\s*$/.exec(line.trim());
    if (m?.[1]) ids.push(m[1].trim());
  }
  return ids;
}

async function walkMarkdown(
  dir: string,
  onFile: (file: string) => Promise<void>,
): Promise<void> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      await walkMarkdown(full, onFile);
    } else if (entry.name.endsWith(".md")) {
      await onFile(full);
    }
  }
}

export type EvaluateGateInput = {
  data: SpecFormData;
  status: SpecStatus;
  /** Extra publishes from the current form (self-publish before save). */
  selfPublishes?: string[];
};

export async function evaluateGateAction(
  input: EvaluateGateInput,
): Promise<GateResult> {
  const catalogIds = await loadPublishesCatalog();
  const publishes = new Set(catalogIds);
  for (const id of input.selfPublishes ?? input.data.publishes ?? []) {
    publishes.add(id);
  }
  return evaluateSpecGate(input.data, input.status, { publishes });
}

export type PublishResult =
  | {
    ok: true;
    pageId: number;
    url: string;
    markdown: string;
    gate: GateResult;
    taskId: string;
  }
  | {
    ok: false;
    error: string;
    gate?: GateResult;
    markdown?: string;
  };

export async function publishSpecAction(input: {
  data: SpecFormData;
  status: SpecStatus;
  pageId?: number;
}): Promise<PublishResult> {
  const parsed = SpecFormSchema.safeParse(input.data);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues.map((i) => i.message).join("; "),
    };
  }

  const data = parsed.data;
  const gate = await evaluateGateAction({
    data,
    status: input.status,
    selfPublishes: data.publishes,
  });

  if (!gate.ok) {
    return {
      ok: false,
      error: "دروازه کیفیت انتشار را مسدود کرد. ابتدا خطاها را برطرف کنید.",
      gate,
      markdown: mapFormToMarkdown(data, input.status),
    };
  }

  if (!hasBookStackConfig()) {
    return {
      ok: false,
      error:
        "BookStack پیکربندی نشده است. BOOKSTACK_URL، BOOKSTACK_TOKEN_ID و BOOKSTACK_TOKEN_SECRET را تنظیم کنید.",
      gate,
      markdown: mapFormToMarkdown(data, input.status),
    };
  }

  if (!data.bookId) {
    return {
      ok: false,
      error: "قبل از انتشار یک کتاب BookStack (bookId) انتخاب کنید.",
      gate,
    };
  }

  const markdown = mapFormToMarkdown(data, input.status);
  const taskId = ensureTaskId(data);
  const client = createBookStackClient();
  const tags = tagsFromBookStack(data.tags);

  try {
    const page = input.pageId
      ? await client.updatePage(input.pageId, {
          name: data.title,
          markdown,
          tags,
        })
      : await client.createPage({
          book_id: data.bookId,
          chapter_id: data.chapterId,
          name: data.title,
          markdown,
          tags,
        });

    if (!input.pageId) {
      await upsertMasterIndexEntry(client, {
        bookId: data.bookId,
        chapterId: data.chapterId,
        entryTitle: page.name,
        entryEntityId: page.id,
        description: oneSentenceDescription(
          data.mission,
          `Agent-Ready spec: ${page.name}`,
        ),
      });
    }

    return {
      ok: true,
      pageId: page.id,
      url: client.pageUrl(page),
      markdown,
      gate,
      taskId,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      gate,
      markdown,
    };
  }
}
