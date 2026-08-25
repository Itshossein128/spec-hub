"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { SpecFormSchema, type SpecFormData } from "@spec-hub/shared-schemas";
import type { GateFinding } from "@spec-hub/codex-gate";
import {
  ensureBookAction,
  ensureChapterAction,
  ensureShelfAction,
  evaluateGateAction,
  listChaptersForBookAction,
  publishSpecAction,
  type BookStackStatus,
} from "@/lib/actions";
import { mapFormToMarkdown, type SpecStatus } from "@/lib/map-form-to-markdown";
import { CreatableSelect } from "./CreatableSelect";
import { GateFindingsPanel } from "./GateFindingsPanel";
import { StringListField, TagHelpers } from "./StringListField";

export type PlacementOption = {
  id: number;
  name: string;
};

export type SpecAuthoringProps = {
  bookStack: BookStackStatus;
  shelves: PlacementOption[];
  books: PlacementOption[];
  placementError?: string;
  initialPublishesCatalog: string[];
};

const STATUS_FA: Record<SpecStatus, string> = {
  Draft: "پیش‌نویس",
  "In-Review": "در حال بررسی",
  "Ready-For-Agent": "آماده برای ایجنت",
};

const AC_LABELS = {
  scenario: "سناریو",
  given: "Given",
  when: "When",
  then: "Then",
} as const;

function defaultValues(): SpecFormData {
  return {
    taskId: "",
    shelf: "Backend-Core",
    book: "Orders",
    chapter: "",
    title: "لغو سفارش: انتشار رویداد OrderCancelled",
    tags: ["repo:orders-service", "domain:checkout"],
    taskType: "FEATURE",
    complexity: "COMPLEX",
    owner: "مهندس ارشد",
    mission:
      "هنگام لغو سفارش، رویداد قابل‌اعتماد OrderCancelled منتشر شود تا صورتحساب و موجودی واکنش نشان دهند.",
    allowedPaths: ["src/modules/orders/"],
    protectedPaths: ["src/core/auth/"],
    nonGoals: ["جریان‌های capture پرداخت تغییر نکند."],
    existingDependencies: [],
    dataContracts: `export interface OrderCancelledV1 {
  orderId: string;
  cancelledAt: string;
  reason: string;
}`,
    acceptanceCriteria: [
      {
        scenario: "لغو تازه",
        given: "یک سفارش باز وجود دارد",
        when: "درخواست لغو ارسال می‌شود",
        then: "OrderCancelledV1 منتشر می‌شود و وضعیت به cancelled می‌رود",
      },
    ],
    repo: "orders-service",
    publishes: ["event:OrderCancelled@v1"],
    consumes: [],
    impacts: ["repo:billing-service#invoice-void"],
    dependsOn: [],
    verificationCommands: {
      lint: "pnpm lint",
      test: "pnpm test",
      coverageThreshold: 80,
    },
  };
}

export function SpecAuthoringWorkspace({
  bookStack,
  shelves,
  books,
  placementError,
  initialPublishesCatalog,
}: SpecAuthoringProps) {
  const [status, setStatus] = useState<SpecStatus>("Draft");
  const [findings, setFindings] = useState<GateFinding[]>([]);
  const [publishMessage, setPublishMessage] = useState<string | null>(null);
  const [publishUrl, setPublishUrl] = useState<string | null>(null);
  const [pageId, setPageId] = useState<number | undefined>();
  const [pending, startTransition] = useTransition();
  const [shelfOptions, setShelfOptions] = useState(shelves);
  const [bookOptions, setBookOptions] = useState(books);
  const [chapterOptions, setChapterOptions] = useState<PlacementOption[]>([]);
  const [placementBusy, setPlacementBusy] = useState<
    null | "shelf" | "book" | "chapter"
  >(null);
  const [placementHint, setPlacementHint] = useState<string | null>(null);

  useEffect(() => {
    setShelfOptions(shelves);
  }, [shelves]);
  useEffect(() => {
    setBookOptions(books);
  }, [books]);

  const form = useForm<SpecFormData>({
    resolver: zodResolver(SpecFormSchema),
    defaultValues: defaultValues(),
    mode: "onBlur",
  });

  const {
    register,
    watch,
    setValue,
    handleSubmit,
    formState: { errors },
  } = form;

  const values = watch();
  const markdown = useMemo(
    () => mapFormToMarkdown(values as SpecFormData, status),
    [values, status],
  );

  const selectedBookId = watch("bookId");

  useEffect(() => {
    if (!selectedBookId || selectedBookId <= 0 || !bookStack.configured) {
      setChapterOptions([]);
      return;
    }
    let cancelled = false;
    void listChaptersForBookAction(selectedBookId).then((res) => {
      if (cancelled) return;
      setChapterOptions(res.chapters);
      if (res.error) setPlacementHint(res.error);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedBookId, bookStack.configured]);

  useEffect(() => {
    // catalog hint until first validate
  }, [initialPublishesCatalog]);

  const upsertOption = (
    list: PlacementOption[],
    item: PlacementOption,
  ): PlacementOption[] => {
    if (list.some((o) => o.id === item.id)) {
      return list.map((o) => (o.id === item.id ? item : o));
    }
    return [...list, item].sort((a, b) => a.name.localeCompare(b.name, "fa"));
  };

  const runGate = (nextStatus: SpecStatus = status) => {
    startTransition(async () => {
      const data = form.getValues();
      const result = await evaluateGateAction({
        data,
        status: nextStatus,
        selfPublishes: data.publishes,
      });
      setFindings(result.findings);
      setPublishMessage(
        result.ok
          ? `دروازه کیفیت برای «${STATUS_FA[nextStatus]}» عبور کرد${result.findings.length ? " (با هشدار)" : ""}.`
          : `دروازه کیفیت وضعیت «${STATUS_FA[nextStatus]}» را مسدود کرد.`,
      );
    });
  };

  const onPublish = (nextStatus: SpecStatus) => {
    setStatus(nextStatus);
    setPublishMessage(null);
    setPublishUrl(null);
    handleSubmit(
      (data: SpecFormData) => {
        startTransition(async () => {
          const result = await publishSpecAction({
            data,
            status: nextStatus,
            pageId,
          });
          if (result.gate) setFindings(result.gate.findings);
          if (!result.ok) {
            setPublishMessage(result.error);
            return;
          }
          setPageId(result.pageId);
          setPublishUrl(result.url);
          setPublishMessage(
            `به‌عنوان «${STATUS_FA[nextStatus]}» منتشر شد (${result.taskId}). وقتی آماده بودید با pnpm bookstack:graph گراف را بازسازی کنید.`,
          );
        });
      },
      (formErrors) => {
        const parts: string[] = [];
        const walk = (obj: unknown, prefix = ""): void => {
          if (!obj || typeof obj !== "object") return;
          for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
            const path = prefix ? `${prefix}.${k}` : k;
            if (v && typeof v === "object" && "message" in v && v.message) {
              parts.push(`${path}: ${String(v.message)}`);
            } else {
              walk(v, path);
            }
          }
        };
        walk(formErrors);
        setPublishMessage(
          parts.length
            ? parts.slice(0, 3).join(" · ")
            : "فرم نامعتبر است؛ فیلدهای علامت‌خورده را اصلاح کنید.",
        );
      },
    )();
  };

  return (
    <div className='grid flex-1 gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]'>
      <form
        className='space-y-4'
        onSubmit={(e) => {
          e.preventDefault();
          runGate(status);
        }}
      >
        {!bookStack.configured ? (
          <div className='section-card border-warn/40 bg-warn-soft/60 text-sm text-warn'>
            توکن‌های BookStack تنظیم نشده‌اند. همچنان می‌توانید مشخصات را
            بنویسید و اعتبارسنجی کنید. برای فعال‌سازی انتشار این متغیرها را
            تنظیم کنید:{" "}
            <code className='font-mono' dir='ltr'>
              BOOKSTACK_URL
            </code>
            ،{" "}
            <code className='font-mono' dir='ltr'>
              BOOKSTACK_TOKEN_ID
            </code>{" "}
            و{" "}
            <code className='font-mono' dir='ltr'>
              BOOKSTACK_TOKEN_SECRET
            </code>
            .
          </div>
        ) : null}
        {placementError ? (
          <div className='section-card border-danger/30 bg-danger-soft text-sm text-danger'>
            بارگذاری جایگاه BookStack ناموفق بود: {placementError}
          </div>
        ) : null}

        <section className='section-card space-y-3'>
          <h2 className='font-display text-lg font-semibold text-accent-ink'>
            جایگاه
          </h2>
          <p className='text-xs text-muted'>
            نگاشت DDD: قفسه = دامنه/اپلیکیشن، کتاب = میکروسرویس، فصل =
            ماژول/موجودیت، صفحه = مشخصات Agent-Ready. ایجاد فصل یا صفحه،
            Index والد را هم به‌روز می‌کند. از لیست انتخاب کنید یا نام جدید
            بسازید.
            {!bookStack.configured
              ? " بدون توکن، فقط نام محلی ذخیره می‌شود (در BookStack ساخته نمی‌شود)."
              : null}
          </p>
          {placementHint ? (
            <p className='text-xs text-warn'>{placementHint}</p>
          ) : null}
          <div className='grid gap-3 sm:grid-cols-2'>
            <CreatableSelect
              label='قفسه (Shelf) — دامنه / اپلیکیشن'
              options={shelfOptions}
              valueId={watch("shelfId")}
              valueName={watch("shelf") ?? ""}
              placeholder='مثلاً Fleet Management…'
              allowCreate
              busy={placementBusy === "shelf"}
              onSelectExisting={(opt) => {
                setValue("shelfId", opt.id || undefined, {
                  shouldValidate: true,
                });
                setValue("shelf", opt.name, { shouldValidate: true });
                setPlacementHint(null);
              }}
              onClear={() => {
                setValue("shelfId", undefined);
                setValue("shelf", "");
              }}
              onCreate={async (name) => {
                setPlacementBusy("shelf");
                setPlacementHint(null);
                const res = await ensureShelfAction(name);
                setPlacementBusy(null);
                if (!res.ok) {
                  setPlacementHint(res.error);
                  return;
                }
                if (res.id > 0) {
                  setShelfOptions((prev) =>
                    upsertOption(prev, { id: res.id, name: res.name }),
                  );
                }
                setValue("shelfId", res.id > 0 ? res.id : undefined, {
                  shouldValidate: true,
                });
                setValue("shelf", res.name, { shouldValidate: true });
                setPlacementHint(
                  res.created
                    ? `قفسه «${res.name}» در BookStack ایجاد شد.`
                    : `قفسه «${res.name}» انتخاب شد.`,
                );
              }}
            />
            <CreatableSelect
              label='کتاب (Book) — میکروسرویس'
              options={bookOptions}
              valueId={watch("bookId")}
              valueName={watch("book") ?? ""}
              placeholder='مثلاً driver-service…'
              allowCreate
              busy={placementBusy === "book"}
              onSelectExisting={(opt) => {
                setValue("bookId", opt.id || undefined, {
                  shouldValidate: true,
                });
                setValue("book", opt.name, { shouldValidate: true });
                setValue("chapterId", undefined);
                setValue("chapter", "");
                setPlacementHint(null);
              }}
              onClear={() => {
                setValue("bookId", undefined);
                setValue("book", "");
                setValue("chapterId", undefined);
                setValue("chapter", "");
                setChapterOptions([]);
              }}
              onCreate={async (name) => {
                setPlacementBusy("book");
                setPlacementHint(null);
                const shelfId = watch("shelfId");
                const res = await ensureBookAction({
                  name,
                  shelfId: shelfId && shelfId > 0 ? shelfId : undefined,
                });
                setPlacementBusy(null);
                if (!res.ok) {
                  setPlacementHint(res.error);
                  return;
                }
                if (res.id > 0) {
                  setBookOptions((prev) =>
                    upsertOption(prev, { id: res.id, name: res.name }),
                  );
                }
                setValue("bookId", res.id > 0 ? res.id : undefined, {
                  shouldValidate: true,
                });
                setValue("book", res.name, { shouldValidate: true });
                setValue("chapterId", undefined);
                setValue("chapter", "");
                setPlacementHint(
                  res.created
                    ? `کتاب «${res.name}» در BookStack ایجاد شد.`
                    : `کتاب «${res.name}» انتخاب شد.`,
                );
              }}
            />
            <div className='sm:col-span-2'>
              <CreatableSelect
                label='فصل (Chapter) — ماژول / موجودیت'
                hint={
                  selectedBookId && selectedBookId > 0
                    ? "برای Ready-For-Agent الزامی است"
                    : "ابتدا کتاب را انتخاب کنید"
                }
                options={chapterOptions}
                valueId={watch("chapterId")}
                valueName={watch("chapter") ?? ""}
                placeholder='مثلاً Driver، Vehicle…'
                disabled={!selectedBookId || selectedBookId <= 0}
                allowCreate={Boolean(selectedBookId && selectedBookId > 0)}
                busy={placementBusy === "chapter"}
                onSelectExisting={(opt) => {
                  setValue("chapterId", opt.id || undefined, {
                    shouldValidate: true,
                  });
                  setValue("chapter", opt.name, { shouldValidate: true });
                  setPlacementHint(null);
                }}
                onClear={() => {
                  setValue("chapterId", undefined);
                  setValue("chapter", "");
                }}
                onCreate={async (name) => {
                  const bookId = watch("bookId");
                  if (!bookId || bookId <= 0) {
                    setPlacementHint("ابتدا کتاب را انتخاب یا ایجاد کنید.");
                    return;
                  }
                  setPlacementBusy("chapter");
                  setPlacementHint(null);
                  const res = await ensureChapterAction({ name, bookId });
                  setPlacementBusy(null);
                  if (!res.ok) {
                    setPlacementHint(res.error);
                    return;
                  }
                  if (res.id > 0) {
                    setChapterOptions((prev) =>
                      upsertOption(prev, { id: res.id, name: res.name }),
                    );
                  }
                  setValue("chapterId", res.id > 0 ? res.id : undefined, {
                    shouldValidate: true,
                  });
                  setValue("chapter", res.name, { shouldValidate: true });
                  setPlacementHint(
                    res.created
                      ? `فصل «${res.name}» در BookStack ایجاد شد.`
                      : `فصل «${res.name}» انتخاب شد.`,
                  );
                }}
              />
            </div>
          </div>
        </section>

        <section className='section-card space-y-3'>
          <h2 className='font-display text-lg font-semibold text-accent-ink'>
            هویت
          </h2>
          <div className='grid gap-3 sm:grid-cols-2'>
            <div className='sm:col-span-2'>
              <label className='field-label' htmlFor='title'>
                عنوان
              </label>
              <input id='title' className='field' {...register("title")} />
              {errors.title ? (
                <p className='mt-1 text-xs text-danger'>
                  {errors.title.message}
                </p>
              ) : null}
            </div>
            <div>
              <label className='field-label' htmlFor='taskId'>
                شناسه تسک
              </label>
              <input
                id='taskId'
                className='field font-mono text-xs'
                dir='ltr'
                placeholder='TSK-2026-08 (اگر خالی باشد خودکار ساخته می‌شود)'
                {...register("taskId")}
              />
            </div>
            <div>
              <label className='field-label' htmlFor='repo'>
                مخزن (Repo)
              </label>
              <input
                id='repo'
                className='field font-mono text-xs'
                dir='ltr'
                {...register("repo")}
              />
            </div>
            <div>
              <label className='field-label' htmlFor='taskType'>
                نوع تسک
              </label>
              <select id='taskType' className='field' {...register("taskType")}>
                <option value='FEATURE'>FEATURE — ویژگی</option>
                <option value='BUGFIX'>BUGFIX — رفع باگ</option>
                <option value='REFACTOR'>REFACTOR — بازآرایی</option>
                <option value='MIGRATION'>MIGRATION — مهاجرت</option>
              </select>
            </div>
            <div>
              <label className='field-label' htmlFor='complexity'>
                پیچیدگی
              </label>
              <select
                id='complexity'
                className='field'
                {...register("complexity")}
              >
                <option value='TRIVIAL'>TRIVIAL — ساده</option>
                <option value='STANDARD'>STANDARD — استاندارد</option>
                <option value='COMPLEX'>COMPLEX — پیچیده</option>
                <option value='ARCHITECTURAL'>ARCHITECTURAL — معماری</option>
              </select>
            </div>
            <div>
              <label className='field-label' htmlFor='owner'>
                مالک
              </label>
              <input id='owner' className='field' {...register("owner")} />
            </div>
          </div>
          <StringListField
            name='tags'
            label='برچسب‌ها'
            hint='فقط برای فیلتر. ترجیحاً repo:… و domain:…'
            watch={watch}
            setValue={setValue}
            register={register}
            mono
            placeholder='repo:orders-service'
          />
          <TagHelpers watch={watch} setValue={setValue} />
        </section>

        <section className='section-card space-y-3'>
          <h2 className='font-display text-lg font-semibold text-accent-ink'>
            مأموریت و مرزهای تغییر
          </h2>
          <div>
            <label className='field-label' htmlFor='mission'>
              مأموریت (Goal)
            </label>
            <textarea
              id='mission'
              className='field min-h-24'
              {...register("mission")}
            />
            {errors.mission ? (
              <p className='mt-1 text-xs text-danger'>
                {errors.mission.message}
              </p>
            ) : null}
          </div>
          <StringListField
            name='allowedPaths'
            label='مسیرهای مجاز'
            watch={watch}
            setValue={setValue}
            register={register}
            mono
            placeholder='src/modules/orders/'
          />
          <StringListField
            name='protectedPaths'
            label='مسیرهای ممنوعه'
            watch={watch}
            setValue={setValue}
            register={register}
            mono
          />
          <StringListField
            name='nonGoals'
            label='نبایدها (Non-Goals)'
            watch={watch}
            setValue={setValue}
            register={register}
          />
        </section>

        <section className='section-card space-y-3'>
          <h2 className='font-display text-lg font-semibold text-accent-ink'>
            روابط بین‌سرویسی
          </h2>
          <p className='text-xs text-muted'>
            یال‌های تایپ‌شده — نه برچسب. شناسه‌های فشرده مثل{" "}
            <code className='font-mono' dir='ltr'>
              event:OrderCancelled@v1
            </code>{" "}
            یا{" "}
            <code className='font-mono' dir='ltr'>
              external:stripe.invoice.paid@v1
            </code>
            .
          </p>
          <StringListField
            name='publishes'
            label='منتشر می‌کند (Publishes)'
            watch={watch}
            setValue={setValue}
            register={register}
            mono
          />
          <StringListField
            name='consumes'
            label='مصرف می‌کند (Consumes)'
            hint='برای Ready-For-Agent باید publishes متناظر وجود داشته باشد (یا external:)'
            watch={watch}
            setValue={setValue}
            register={register}
            mono
          />
          <StringListField
            name='impacts'
            label='تأثیر می‌گذارد (Impacts)'
            watch={watch}
            setValue={setValue}
            register={register}
            mono
            placeholder='repo:billing-service#invoice-void'
          />
          <StringListField
            name='dependsOn'
            label='وابسته به (Depends on)'
            watch={watch}
            setValue={setValue}
            register={register}
            mono
            placeholder='TSK-BILL-011'
          />
        </section>

        <section className='section-card space-y-3'>
          <h2 className='font-display text-lg font-semibold text-accent-ink'>
            ابزارهای موجود و قراردادها
          </h2>
          <StringListField
            name='existingDependencies'
            label='ابزارها / کدهای اشتراکی'
            watch={watch}
            setValue={setValue}
            register={register}
            mono
          />
          <div>
            <label className='field-label' htmlFor='dataContracts'>
              قراردادهای داده (TypeScript)
            </label>
            <textarea
              id='dataContracts'
              className='field min-h-32 font-mono text-xs'
              dir='ltr'
              {...register("dataContracts")}
            />
          </div>
        </section>

        <section className='section-card space-y-3'>
          <div className='flex items-center justify-between gap-2'>
            <h2 className='font-display text-lg font-semibold text-accent-ink'>
              معیارهای پذیرش
            </h2>
            <button
              type='button'
              className='rounded border border-border px-2 py-1 text-xs font-semibold hover:bg-accent-soft'
              onClick={() =>
                setValue("acceptanceCriteria", [
                  ...watch("acceptanceCriteria"),
                  { scenario: "", given: "", when: "", then: "" },
                ])
              }
            >
              افزودن سناریو
            </button>
          </div>
          {(watch("acceptanceCriteria") ?? []).map((_, index) => (
            <div
              key={index}
              className='space-y-2 rounded-lg border border-border/80 bg-surface p-3'
            >
              <div className='flex items-center justify-between'>
                <p className='text-xs font-semibold tracking-wide text-muted'>
                  سناریو {index + 1}
                </p>
                <button
                  type='button'
                  className='text-xs text-muted hover:text-danger'
                  onClick={() => {
                    const next = [...watch("acceptanceCriteria")];
                    next.splice(index, 1);
                    setValue(
                      "acceptanceCriteria",
                      next.length
                        ? next
                        : [{ scenario: "", given: "", when: "", then: "" }],
                    );
                  }}
                >
                  حذف
                </button>
              </div>
              {(["scenario", "given", "when", "then"] as const).map((key) => (
                <div key={key}>
                  <label className='field-label' htmlFor={`ac-${index}-${key}`}>
                    {AC_LABELS[key]}
                  </label>
                  <input
                    id={`ac-${index}-${key}`}
                    className='field'
                    {...register(`acceptanceCriteria.${index}.${key}`)}
                  />
                </div>
              ))}
            </div>
          ))}
        </section>

        <section className='section-card space-y-3'>
          <h2 className='font-display text-lg font-semibold text-accent-ink'>
            راستی‌آزمایی
          </h2>
          <div className='grid gap-3 sm:grid-cols-3'>
            <div>
              <label className='field-label' htmlFor='lint'>
                Lint
              </label>
              <input
                id='lint'
                className='field font-mono text-xs'
                dir='ltr'
                {...register("verificationCommands.lint")}
              />
            </div>
            <div>
              <label className='field-label' htmlFor='test'>
                Test
              </label>
              <input
                id='test'
                className='field font-mono text-xs'
                dir='ltr'
                {...register("verificationCommands.test")}
              />
            </div>
            <div>
              <label className='field-label' htmlFor='coverage'>
                پوشش حداقل ٪
              </label>
              <input
                id='coverage'
                type='number'
                className='field'
                dir='ltr'
                {...register("verificationCommands.coverageThreshold", {
                  valueAsNumber: true,
                })}
              />
            </div>
          </div>
        </section>

        <section className='section-card space-y-3'>
          <h2 className='font-display text-lg font-semibold text-accent-ink'>
            اقدامات
          </h2>
          <div className='flex flex-wrap gap-2'>
            <button
              type='button'
              disabled={pending}
              className='rounded-md border border-border bg-surface px-4 py-2 text-sm font-semibold hover:bg-accent-soft disabled:opacity-60'
              onClick={() => {
                setStatus("Draft");
                runGate("Draft");
              }}
            >
              اعتبارسنجی به‌عنوان پیش‌نویس
            </button>
            <button
              type='button'
              disabled={pending || !bookStack.configured}
              className='rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-ink disabled:opacity-60'
              onClick={() => onPublish("Draft")}
            >
              ذخیره پیش‌نویس در BookStack
            </button>
            <button
              type='button'
              disabled={pending || !bookStack.configured}
              className='rounded-md bg-accent-ink px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60'
              onClick={() => onPublish("Ready-For-Agent")}
            >
              انتشار آماده برای ایجنت
            </button>
          </div>
          {pending ? (
            <p className='text-sm text-muted'>
              در حال اجرای دروازه کیفیت (اعتبارسنجی/آماده برای ایجنت شامل Codex
              CLI است و ممکن است طول بکشد)…
            </p>
          ) : null}
          {publishMessage ? (
            <p className='text-sm text-muted'>{publishMessage}</p>
          ) : null}
          {publishUrl ? (
            <p className='text-sm'>
              <a
                className='font-semibold text-accent underline'
                href={publishUrl}
                target='_blank'
                rel='noreferrer'
              >
                باز کردن صفحه BookStack
              </a>
            </p>
          ) : null}
        </section>
      </form>

      <aside className='space-y-4 lg:sticky lg:top-4 lg:self-start'>
        <section className='section-card'>
          <div className='mb-3 flex items-center justify-between gap-2'>
            <h2 className='font-display text-lg font-semibold text-accent-ink'>
              پیش‌نمایش Markdown
            </h2>
            <span className='rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent-ink'>
              {STATUS_FA[status]}
            </span>
          </div>
          <pre
            className='max-h-[50vh] overflow-auto rounded-lg border border-border bg-[#0f171c] p-3 font-mono text-[11px] leading-relaxed text-[#d7e2ea]'
            dir='ltr'
          >
            {markdown}
          </pre>
        </section>
        <section className='section-card'>
          <h2 className='mb-3 font-display text-lg font-semibold text-accent-ink'>
            دروازه کیفیت
          </h2>
          <GateFindingsPanel findings={findings} />
          {initialPublishesCatalog.length ? (
            <p className='mt-3 text-xs text-muted'>
              کاتالوگ publishes بارگذاری شد: {initialPublishesCatalog.length}{" "}
              قرارداد از corpus/fixtures.
            </p>
          ) : (
            <p className='mt-3 text-xs text-muted'>
              کاتالوگ publishes خالی است — برای consumes در Ready-For-Agent از{" "}
              <code className='font-mono' dir='ltr'>
                external:
              </code>{" "}
              استفاده کنید یا خودتان publish کنید.
            </p>
          )}
        </section>
      </aside>
    </div>
  );
}
