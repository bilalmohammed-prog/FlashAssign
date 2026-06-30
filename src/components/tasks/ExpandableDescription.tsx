"use client";

import { useId, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type ExpandableDescriptionProps = {
  value: string | null;
  onChange: (nextValue: string) => void;
  onCommit: (nextValue: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
};

export function ExpandableDescription({
  value,
  onChange,
  onCommit,
  disabled = false,
  placeholder = "Description",
  className,
}: ExpandableDescriptionProps) {
  const [expanded, setExpanded] = useState(false);
  const contentId = useId();
  const normalizedValue = value ?? "";
  const hasValue = useMemo(() => normalizedValue.trim().length > 0, [normalizedValue]);
  const label = hasValue ? "Description" : disabled ? placeholder : "Description";
  const textareaValue = disabled && !hasValue ? "" : normalizedValue;

  return (
    <div className={cn("relative space-y-2", className)}>
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="cursor-pointer group inline-flex w-fit max-w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-800"
        aria-expanded={expanded}
        aria-controls={contentId}
      >
        <span className="flex items-center gap-1">
          {label}
          <ChevronDown className={cn("h-3 w-3 transition-transform", expanded ? "rotate-180" : "rotate-0")} />
        </span>
      </button>

      <div
        id={contentId}
        className={cn(
          "transition-[max-height,opacity] duration-200",
          expanded ? "max-h-48 opacity-100 pointer-events-auto" : "max-h-0 opacity-0 pointer-events-none"
        )}
      >
        <div className="rounded-md border border-zinc-200 bg-white p-0.5 transition-[box-shadow,border-color] focus-within:border-transparent focus-within:ring-2 focus-within:ring-indigo-500">
          <textarea
            value={textareaValue}
            onChange={(e) => onChange(e.target.value)}
            onBlur={(e) => onCommit(e.target.value)}
            rows={2}
            disabled={disabled}
            placeholder={placeholder}
            className="w-full resize-none rounded-[5px] border border-transparent bg-transparent px-2.5 py-2 text-sm text-zinc-700 placeholder:text-zinc-400 outline-none disabled:cursor-default"
          />
        </div>
      </div>
    </div>
  );
}
