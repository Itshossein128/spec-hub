import {
  getBookStackStatus,
  listBookStackPlacement,
  loadPublishesCatalog,
} from "@/lib/actions";
import { SpecAuthoringWorkspace } from "@/components/spec-form/SpecAuthoringWorkspace";

export const dynamic = "force-dynamic";

export default async function NewSpecPage() {
  const [bookStack, placement, publishes] = await Promise.all([
    getBookStackStatus(),
    listBookStackPlacement(),
    loadPublishesCatalog(),
  ]);

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-accent-ink">
          مشخصات جدید
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          یک مشخصات Agent-Ready با روابط تایپ‌شده بنویسید. در حالت پیش‌نویس،
          مصرف یتیم فقط هشدار می‌دهد؛ در «آماده برای ایجنت» تا وجود ناشر مسدود
          می‌شود.
        </p>
      </div>
      <SpecAuthoringWorkspace
        bookStack={bookStack}
        shelves={placement.shelves.map((s) => ({ id: s.id, name: s.name }))}
        books={placement.books.map((b) => ({ id: b.id, name: b.name }))}
        placementError={placement.error}
        initialPublishesCatalog={publishes}
      />
    </div>
  );
}
