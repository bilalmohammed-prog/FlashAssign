"use client";

import * as React from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";

import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import { Button } from "@/components/ui/button";

interface Props {
  value?: string | null;
  onChange: (value: string | null) => void;
  variant?: "ghost" | "outline";
  className?: string;
  placeholder?: string;
  ghostPlaceholder?: boolean;
  danger?: boolean;
  disabled?: boolean;
}

export function DatePicker({
  value,
  onChange,
  variant = "ghost",
  className,
  placeholder = "Set date",
  ghostPlaceholder = false,
  danger = false,
  disabled = false,
}: Props) {
  const date = value ? new Date(value) : undefined;
  const [open, setOpen] = React.useState(false);
  return (
    <Popover
    open={disabled ? false : open}
    onOpenChange={(next) => {
      if (!disabled) setOpen(next);
    }}>
      <PopoverTrigger asChild>
        <Button
          onClick={(e) => e.stopPropagation()}
          variant={variant}
          className={`gap-0 ${disabled ? "cursor-default" : "cursor-pointer"} ${className ?? ""}`}
        >


          {date ? (
  <span
  className={`inline-flex items-center gap-1 ${
    danger ? "text-red-600 hover:text-red-700" : "text-zinc-600 hover:text-zinc-900"
  }`}
>
  <CalendarIcon className="h-4 w-4 text-current" />
  <span className={danger ? "font-medium" : ""}>
    {format(date, "d MMM yyyy")}
  </span>
</span>
) : (
  <span
  className={`inline-flex items-center gap-1 select-none ${
    ghostPlaceholder
      ? "opacity-0 transition-opacity group-hover:opacity-100"
      : ""
  }`}
>
  <CalendarIcon className="h-4 w-4 text-zinc-500" />
  <span className="font-normal text-zinc-600">
    {placeholder}
  </span>
</span>
)}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-auto p-0">

        <Calendar
          mode="single"
          selected={date}
          onSelect={(d) => {
            if (!d) {
              onChange(null);
              return;
            }

            onChange(format(d, "yyyy-MM-dd"));
          }}
        />

      </PopoverContent>
    </Popover>
  );
}