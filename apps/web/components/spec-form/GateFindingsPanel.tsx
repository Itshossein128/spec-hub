"use client";

import type { GateFinding } from "@spec-hub/codex-gate";

const severityClass: Record<GateFinding["severity"], string> = {
  error: "border-danger/40 bg-danger-soft text-danger",
  warning: "border-warn/40 bg-warn-soft text-warn",
  info: "border-border bg-surface text-muted",
};

const severityLabel: Record<GateFinding["severity"], string> = {
  error: "خطا",
  warning: "هشدار",
  info: "اطلاع",
};

export function GateFindingsPanel({
  findings,
  emptyHint,
}: {
  findings: GateFinding[];
  emptyHint?: string;
}) {
  if (!findings.length) {
    return (
      <p className='text-sm text-muted'>
        {emptyHint ??
          "هنوز یافته‌ای از دروازه کیفیت نیست. برای اجرا، اعتبارسنجی یا انتشار را بزنید."}
      </p>
    );
  }

  return (
    <ul className='space-y-2'>
      {findings.map((f, i) => (
        <li
          key={`${f.code}-${i}`}
          className={`rounded-md border px-3 py-2 text-sm ${severityClass[f.severity]}`}
        >
          <p className='font-semibold tracking-wide'>
            {severityLabel[f.severity]} · {f.code}
            {f.field ? (
              <span className='font-normal opacity-80' dir='ltr'>
                {" "}
                · {String(f.field)}
              </span>
            ) : null}
          </p>
          <p className='mt-1' dir='auto'>
            {f.message}
          </p>
        </li>
      ))}
    </ul>
  );
}
