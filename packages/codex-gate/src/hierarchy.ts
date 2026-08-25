import type { SpecFormData } from "@spec-hub/shared-schemas";
import type { GateFinding, GateResult } from "./gate.js";

export type HierarchyPlacement = {
  shelf?: string;
  book?: string;
  chapter?: string;
  shelfId?: number;
  bookId?: number;
  chapterId?: number;
  /** Draft | In-Review | Ready-For-Agent | Done | … */
  status?: string;
};

/**
 * Enforce BookStack DDD placement:
 * Shelf = domain, Book = microservice, Chapter = module.
 * Ready-For-Agent / Done pages should live under a Chapter (module).
 */
export function assertHierarchyPlacement(
  placement: HierarchyPlacement | SpecFormData,
  options?: { statusOverride?: string },
): GateResult {
  const findings: GateFinding[] = [];
  const status =
    options?.statusOverride ??
    ("status" in placement ? placement.status : undefined) ??
    "Draft";
  const strict = status === "Ready-For-Agent" || status === "Done";

  const shelf =
    "shelf" in placement && typeof placement.shelf === "string"
      ? placement.shelf.trim()
      : "";
  const book =
    "book" in placement && typeof placement.book === "string"
      ? placement.book.trim()
      : "";
  const chapter =
    "chapter" in placement && typeof placement.chapter === "string"
      ? placement.chapter.trim()
      : "";
  const bookId =
    "bookId" in placement && typeof placement.bookId === "number"
      ? placement.bookId
      : undefined;
  const chapterId =
    "chapterId" in placement && typeof placement.chapterId === "number"
      ? placement.chapterId
      : undefined;

  if (!shelf) {
    findings.push({
      code: "HIERARCHY_SHELF_REQUIRED",
      severity: "error",
      message:
        "Shelf (macro domain / application) is required — e.g. Fleet Management.",
      field: "shelf",
    });
  }

  if (!book) {
    findings.push({
      code: "HIERARCHY_BOOK_REQUIRED",
      severity: "error",
      message:
        "Book (microservice / micro-frontend) is required — one deployable unit.",
      field: "book",
    });
  }

  const hasChapter = Boolean(chapter) || Boolean(chapterId && chapterId > 0);

  if (strict && !hasChapter) {
    findings.push({
      code: "HIERARCHY_CHAPTER_REQUIRED",
      severity: "error",
      message:
        "Ready-For-Agent specs must target a Chapter (module / business entity), not only Book root.",
      field: "chapter",
    });
  } else if (!hasChapter) {
    findings.push({
      code: "HIERARCHY_CHAPTER_RECOMMENDED",
      severity: "warning",
      message:
        "Prefer a Chapter (module/entity) so Book Index and Chapter Index stay navigable.",
      field: "chapter",
    });
  }

  if (strict && book && !bookId) {
    findings.push({
      code: "HIERARCHY_BOOK_ID_REQUIRED",
      severity: "error",
      message:
        "Select or create the Book in BookStack (bookId) before Ready-For-Agent publish.",
      field: "bookId",
    });
  }

  return {
    ok: findings.every((f) => f.severity !== "error"),
    findings,
  };
}
