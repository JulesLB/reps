"use client";

import { useEffect, useRef, useState } from "react";
import { MinusIcon, PlusIcon } from "./icons";
import { formatWeight } from "@/lib/logic";

interface NumberFieldProps {
  value: number;
  step: number;
  min?: number;
  label: string;
  onChange: (v: number) => void;
  dimmed?: boolean;
}

export default function NumberField({ value, step, min = 0, label, onChange, dimmed }: NumberFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const commit = () => {
    const v = parseFloat(draft.replace(",", "."));
    if (!Number.isNaN(v) && v >= min) onChange(Math.round(v * 100) / 100);
    setEditing(false);
  };

  return (
    <div className="flex min-w-0 flex-1 items-center">
      <button
        type="button"
        aria-label={`Decrease ${label}`}
        onClick={() => onChange(Math.max(min, Math.round((value - step) * 100) / 100))}
        className="flex h-11 w-8 shrink-0 items-center justify-center rounded-l-xl border border-line bg-surface-2 text-muted transition-colors duration-150 active:bg-line hover:text-ink"
      >
        <MinusIcon className="h-4 w-4" />
      </button>
      {editing ? (
        <input
          ref={inputRef}
          type="number"
          inputMode="decimal"
          aria-label={label}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === "Enter" && commit()}
          className="num display h-11 w-full min-w-[42px] flex-1 border-y border-line bg-surface-2 text-center text-lg font-semibold text-volt outline-none"
        />
      ) : (
        <button
          type="button"
          aria-label={`${label}: ${value}. Tap to type`}
          onClick={() => {
            setDraft(String(value));
            setEditing(true);
          }}
          className={`num display h-11 min-w-[42px] flex-1 border-y border-line bg-surface-2 text-center text-lg font-semibold transition-colors duration-150 ${
            dimmed ? "text-faint" : "text-ink"
          }`}
        >
          {formatWeight(value)}
        </button>
      )}
      <button
        type="button"
        aria-label={`Increase ${label}`}
        onClick={() => onChange(Math.round((value + step) * 100) / 100)}
        className="flex h-11 w-8 shrink-0 items-center justify-center rounded-r-xl border border-line bg-surface-2 text-muted transition-colors duration-150 active:bg-line hover:text-ink"
      >
        <PlusIcon className="h-4 w-4" />
      </button>
    </div>
  );
}
