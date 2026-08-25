"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

export type CreatableOption = { id: number; name: string };

type Props = {
  label: string;
  hint?: string;
  options: CreatableOption[];
  valueId?: number;
  valueName: string;
  placeholder?: string;
  disabled?: boolean;
  allowCreate: boolean;
  busy?: boolean;
  onSelectExisting: (option: CreatableOption) => void;
  onCreate: (name: string) => void | Promise<void>;
  onClear?: () => void;
};

/**
 * Combobox: pick from BookStack list or type a new name and create.
 */
export function CreatableSelect({
  label,
  hint,
  options,
  valueId,
  valueName,
  placeholder,
  disabled,
  allowCreate,
  busy,
  onSelectExisting,
  onCreate,
  onClear,
}: Props) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(valueName);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(valueName);
  }, [valueName]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.name.toLowerCase().includes(q));
  }, [options, query]);

  const exactMatch = options.some(
    (o) => o.name.trim().toLowerCase() === query.trim().toLowerCase(),
  );
  const canCreate =
    allowCreate && query.trim().length > 0 && !exactMatch && !disabled;

  return (
    <div ref={rootRef} className="relative">
      <label className="field-label" htmlFor={listId}>
        {label}
      </label>
      {hint ? <p className="mb-1 text-xs text-muted">{hint}</p> : null}
      <div className="flex gap-2">
        <input
          id={listId}
          className="field"
          disabled={disabled || busy}
          placeholder={placeholder}
          value={query}
          autoComplete="off"
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (canCreate) void onCreate(query.trim());
              else if (filtered[0]) onSelectExisting(filtered[0]);
              setOpen(false);
            }
            if (e.key === "Escape") setOpen(false);
          }}
        />
        {valueName || valueId ? (
          <button
            type="button"
            className="shrink-0 rounded border border-border px-2 text-xs text-muted hover:text-danger"
            disabled={busy}
            onClick={() => {
              setQuery("");
              onClear?.();
            }}
            aria-label="پاک کردن"
          >
            ✕
          </button>
        ) : null}
      </div>
      {open && !disabled ? (
        <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-md border border-border bg-surface-elevated py-1 shadow-lg">
          {filtered.map((opt) => (
            <li key={opt.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between px-3 py-2 text-right text-sm hover:bg-accent-soft"
                onClick={() => {
                  onSelectExisting(opt);
                  setQuery(opt.name);
                  setOpen(false);
                }}
              >
                <span>{opt.name}</span>
                <span className="font-mono text-xs text-muted" dir="ltr">
                  #{opt.id}
                </span>
              </button>
            </li>
          ))}
          {canCreate ? (
            <li>
              <button
                type="button"
                className="flex w-full items-center gap-2 border-t border-border px-3 py-2 text-right text-sm font-semibold text-accent-ink hover:bg-accent-soft"
                onClick={() => {
                  void onCreate(query.trim());
                  setOpen(false);
                }}
              >
                ایجاد «{query.trim()}»
              </button>
            </li>
          ) : null}
          {!filtered.length && !canCreate ? (
            <li className="px-3 py-2 text-sm text-muted">موردی یافت نشد</li>
          ) : null}
        </ul>
      ) : null}
      {busy ? (
        <p className="mt-1 text-xs text-muted">در حال همگام‌سازی با BookStack…</p>
      ) : null}
    </div>
  );
}
