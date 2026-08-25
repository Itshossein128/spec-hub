"use client";

import { useCallback } from "react";
import type {
  FieldPath,
  UseFormRegister,
  UseFormSetValue,
  UseFormWatch,
} from "react-hook-form";
import type { SpecFormData } from "@spec-hub/shared-schemas";

type ListProps = {
  name:
    | "tags"
    | "allowedPaths"
    | "protectedPaths"
    | "nonGoals"
    | "existingDependencies"
    | "publishes"
    | "consumes"
    | "impacts"
    | "dependsOn";
  label: string;
  hint?: string;
  watch: UseFormWatch<SpecFormData>;
  setValue: UseFormSetValue<SpecFormData>;
  register: UseFormRegister<SpecFormData>;
  mono?: boolean;
  placeholder?: string;
};

/** Simple string[] editor for paths, tags, relations, etc. */
export function StringListField({
  name,
  label,
  hint,
  watch,
  setValue,
  register,
  mono,
  placeholder,
}: ListProps) {
  const values = (watch(name) as string[] | undefined) ?? [];

  const add = () => {
    setValue(name, [...values, ""], {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  const remove = (index: number) => {
    setValue(
      name,
      values.filter((_, i) => i !== index),
      { shouldDirty: true, shouldValidate: true },
    );
  };

  return (
    <div>
      <div className='mb-2 flex items-end justify-between gap-2'>
        <div>
          <span className='field-label mb-0'>{label}</span>
          {hint ? <p className='text-xs text-muted'>{hint}</p> : null}
        </div>
        <button
          type='button'
          className='rounded border border-border px-2 py-1 text-xs font-semibold text-accent-ink hover:bg-accent-soft'
          onClick={add}
        >
          افزودن
        </button>
      </div>
      <ul className='space-y-2'>
        {values.map((_, index) => (
          <li key={`${name}-${index}`} className='flex gap-2'>
            <input
              className={`field ${mono ? "font-mono text-xs" : ""}`}
              dir={mono ? "ltr" : "auto"}
              placeholder={placeholder}
              {...register(`${name}.${index}` as FieldPath<SpecFormData>)}
            />
            <button
              type='button'
              className='shrink-0 rounded border border-border px-2 text-xs text-muted hover:text-danger'
              onClick={() => remove(index)}
              aria-label='حذف'
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

type TagHelpersProps = {
  watch: UseFormWatch<SpecFormData>;
  setValue: UseFormSetValue<SpecFormData>;
};

export function TagHelpers({ watch, setValue }: TagHelpersProps) {
  const tags = watch("tags") ?? [];
  const repo = watch("repo");

  const ensure = useCallback(
    (tag: string) => {
      if (tags.includes(tag)) return;
      setValue("tags", [...tags, tag], {
        shouldDirty: true,
        shouldValidate: true,
      });
    },
    [setValue, tags],
  );

  return (
    <div className='mt-2 flex flex-wrap gap-2'>
      {repo ? (
        <button
          type='button'
          className='rounded-full border border-border bg-surface px-2 py-1 text-xs hover:bg-accent-soft'
          onClick={() => ensure(`repo:${repo}`)}
        >
          + repo:{repo}
        </button>
      ) : null}
      <button
        type='button'
        className='rounded-full border border-border bg-surface px-2 py-1 text-xs hover:bg-accent-soft'
        onClick={() => ensure("domain:checkout")}
      >
        + domain:checkout
      </button>
      <button
        type='button'
        className='rounded-full border border-border bg-surface px-2 py-1 text-xs hover:bg-accent-soft'
        onClick={() => ensure("domain:platform")}
      >
        + domain:platform
      </button>
    </div>
  );
}
