"use client";

import { cn } from "@/lib/utils";

type DescriptionEditorProps = {
  value: string | null;
  onChange: (nextValue: string) => void;
  onCommit: (nextValue: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
};

export function DescriptionEditor({
  value,
  onChange,
  onCommit,
  disabled = false,
  placeholder = "No description yet",
  className,
}: DescriptionEditorProps) {
  const normalizedValue = value ?? "";
  const textareaValue = disabled && !normalizedValue.trim() ? "" : normalizedValue;

  return (
   <div className={cn("flex h-full flex-col", className)}>
  <div className="flex h-full flex-col rounded-md border border-zinc-200 bg-white p-3 transition-[box-shadow,border-color] focus-within:border-transparent focus-within:ring-2 focus-within:ring-indigo-500">

    <h3 className="mb-2 text-[13px] font-medium text-zinc-500">
      Description
    </h3>

    <textarea
      value={textareaValue}
      onChange={(e) => onChange(e.target.value)}
      onBlur={(e) => onCommit(e.target.value)}
      disabled={disabled}
      placeholder={placeholder}
      className="min-h-0 flex-1 resize-none overflow-y-auto border-none bg-transparent text-sm text-zinc-700 placeholder:text-zinc-400 outline-none disabled:cursor-default"
    />
  </div>
</div>
  );
}