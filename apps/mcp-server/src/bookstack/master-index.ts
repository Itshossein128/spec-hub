import type { BookStackClient } from "./client.js";

const INDEX_NAME = "Index";

function emptyIndexMarkdown(scope: "book" | "chapter"): string {
  const title =
    scope === "book"
      ? "# Index\n\nMaster index for this microservice Book (TOC).\n\n## Chapters & pages\n"
      : "# Index\n\nMaster index for this module Chapter (TOC).\n\n## Pages\n";
  return title;
}

function entryLine(title: string, url: string, description: string): string {
  const desc = description.trim().replace(/\s+/g, " ");
  return `- [${title}](${url}) — ${desc}`;
}

/**
 * Ensure an Index page exists under book (root) or chapter and append a TOC entry
 * if not already present (Master Index governance rule).
 */
export async function upsertMasterIndexEntry(
  client: BookStackClient,
  input: {
    bookId: number;
    /** If set, Index lives in the chapter; otherwise at book root. */
    chapterId?: number;
    entryTitle: string;
    entryEntityId: number;
    description: string;
  },
): Promise<{ indexPageId: number; updated: boolean }> {
  const listed = await client.listPages({
    bookId: input.bookId,
    chapterId: input.chapterId,
    count: 200,
  });

  const candidates = listed.data.filter(
    (p) => p.name === INDEX_NAME || p.name === "Index.md",
  );
  let index = candidates.find((p) =>
    input.chapterId
      ? p.chapter_id === input.chapterId
      : !p.chapter_id || p.chapter_id === 0,
  );

  const link = client.entityLink(input.entryEntityId);
  const line = entryLine(input.entryTitle, link, input.description);

  if (!index) {
    const scope = input.chapterId ? "chapter" : "book";
    const created = await client.createPage({
      book_id: input.bookId,
      chapter_id: input.chapterId,
      name: INDEX_NAME,
      markdown: `${emptyIndexMarkdown(scope)}\n${line}\n`,
    });
    return { indexPageId: created.id, updated: true };
  }

  const full = await client.getPage(index.id);
  const body = full.markdown ?? "";
  if (body.includes(link) || body.includes(`](${link})`)) {
    return { indexPageId: index.id, updated: false };
  }

  const next = body.trimEnd().endsWith("\n")
    ? `${body.trimEnd()}\n${line}\n`
    : `${body.trimEnd()}\n\n${line}\n`;
  await client.updatePage(index.id, { markdown: next });
  return { indexPageId: index.id, updated: true };
}

export function oneSentenceDescription(text: string, fallback: string): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return fallback;
  const sentence = cleaned.split(/(?<=[.!?])\s+/)[0] ?? cleaned;
  return sentence.length > 160 ? `${sentence.slice(0, 157)}…` : sentence;
}
