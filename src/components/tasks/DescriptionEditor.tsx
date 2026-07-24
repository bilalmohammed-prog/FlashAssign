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
  placeholder = "Description",
  className,
}: DescriptionEditorProps) {
  const normalizedValue = value ?? "";
  const textareaValue = disabled && !normalizedValue.trim() ? "" : normalizedValue;

  return (
    <div className={cn("flex h-full flex-col", className)}>
      <div className="flex h-full rounded-md border border-zinc-200 bg-white p-0.5 transition-[box-shadow,border-color] focus-within:border-transparent focus-within:ring-2 focus-within:ring-indigo-500">
        <textarea
          value={textareaValue}
          onChange={(e) => onChange(e.target.value)}
          onBlur={(e) => onCommit(e.target.value)}
          disabled={disabled}
          placeholder={placeholder}
          className="h-full w-full resize-none overflow-y-auto rounded-[5px] border border-transparent bg-transparent px-2.5 py-2 text-sm text-zinc-700 placeholder:text-zinc-400 outline-none disabled:cursor-default"
        />
      </div>
    </div>
  );
}