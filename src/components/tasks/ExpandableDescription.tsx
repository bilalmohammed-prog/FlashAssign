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
  placeholder = "Add description",
  className,
}: ExpandableDescriptionProps) {
  const [expanded, setExpanded] = useState(false);
  const contentId = useId();
  const normalizedValue = value ?? "";
  const hasValue = useMemo(() => normalizedValue.trim().length > 0, [normalizedValue]);
  const label = hasValue ? "Description" : "Add description";

  return (
    <div className={cn("space-y-2", className)}>
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-800"
        aria-expanded={expanded}
        aria-controls={contentId}
      >
        {label}
        <ChevronDown className={cn("h-3 w-3 transition-transform", expanded ? "rotate-180" : "rotate-0")} />
      </button>

      <div
        id={contentId}
        className={cn(
          "overflow-hidden transition-[max-height,opacity] duration-200",
          expanded ? "max-h-40 opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <textarea
          value={normalizedValue}
          onChange={(e) => onChange(e.target.value)}
          onBlur={(e) => onCommit(e.target.value)}
          rows={2}
          disabled={disabled}
          placeholder={placeholder}
          className="w-full resize-none rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 placeholder:text-zinc-400 outline-none transition-[border-color,box-shadow] focus:border-transparent focus:ring-2 focus:ring-indigo-500 disabled:cursor-default"
        />
      </div>
    </div>
  );
}
