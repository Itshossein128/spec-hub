import type { SpecFormData } from "@spec-hub/shared-schemas";
import {
  createBookStackClient,
  hasBookStackConfig,
  type BookStackClient,
} from "./bookstack";

const MAX_CONTEXT_CHARS = 12_000;
const MAX_SIBLINGS = 5;
const EXCERPT_CHARS = 600;

function clip(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

async function findIndexMarkdown(
  client: BookStackClient,
  bookId: number,
  chapterId?: number,
): Promise<string | null> {
  const listed = await client.listPages({
    bookId,
    chapterId,
    count: 100,
  });
  const index = listed.data.find(
    (p) =>
      (p.name === "Index" || p.name === "Index.md") &&
      (chapterId
        ? p.chapter_id === chapterId
        : !p.chapter_id || p.chapter_id === 0),
  );
  if (!index) return null;
  const full = await client.getPage(index.id);
  return full.markdown ?? null;
}

/**
 * Build RELATED CONTEXT for Codex: Master Index + sibling page excerpts.
 */
export async function gatherSpecReviewContext(
  data: SpecFormData,
  options?: { publishesCatalog?: string[] },
): Promise<string> {
  const parts: string[] = [];

  parts.push("### Placement");
  parts.push(
    `- shelf: ${data.shelf}${data.shelfId ? ` (#${data.shelfId})` : ""}`,
  );
  parts.push(
    `- book: ${data.book}${data.bookId ? ` (#${data.bookId})` : ""}`,
  );
  parts.push(
    `- chapter: ${data.chapter || "(none)"}${
      data.chapterId ? ` (#${data.chapterId})` : ""
    }`,
  );

  if (options?.publishesCatalog?.length) {
    parts.push("\n### Publishes catalog (known contracts)");
    parts.push(
      options.publishesCatalog
        .slice(0, 40)
        .map((id) => `- ${id}`)
        .join("\n"),
    );
  }

  if (!hasBookStackConfig() || !data.bookId) {
    parts.push(
      "\n### BookStack",
      "(tokens missing or bookId unset — Index/siblings unavailable)",
    );
    return clip(parts.join("\n"), MAX_CONTEXT_CHARS);
  }

  try {
    const client = createBookStackClient();
    const bookId = data.bookId;

    const bookIndex = await findIndexMarkdown(client, bookId);
    if (bookIndex) {
      parts.push("\n### Book Master Index");
      parts.push(clip(bookIndex, 2500));
    } else {
      parts.push("\n### Book Master Index\n(missing — governance requires Index)");
    }

    if (data.chapterId && data.chapterId > 0) {
      const chapterIndex = await findIndexMarkdown(
        client,
        bookId,
        data.chapterId,
      );
      if (chapterIndex) {
        parts.push("\n### Chapter Master Index");
        parts.push(clip(chapterIndex, 2000));
      } else {
        parts.push(
          "\n### Chapter Master Index\n(missing — governance requires Index)",
        );
      }
    }

    const siblings = await client.listPages({
      bookId,
      chapterId: data.chapterId,
      count: 50,
    });
    const pages = siblings.data
      .filter((p) => p.name !== "Index" && p.name !== "Index.md")
      .slice(0, MAX_SIBLINGS);

    if (pages.length) {
      parts.push("\n### Sibling pages (excerpts)");
      for (const summary of pages) {
        try {
          const full = await client.getPage(summary.id);
          const body = full.markdown ?? "";
          parts.push(`\n#### ${summary.name} (id=${summary.id})`);
          parts.push(clip(body, EXCERPT_CHARS));
        } catch {
          parts.push(`\n#### ${summary.name} (id=${summary.id})`);
          parts.push("(could not load markdown)");
        }
      }
    }
  } catch (err) {
    parts.push(
      `\n### BookStack context error\n${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }

  return clip(parts.join("\n"), MAX_CONTEXT_CHARS);
}
