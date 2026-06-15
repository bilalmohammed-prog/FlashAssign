"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import ComposeMessagePopup from "@/components/ComposeMessagePopup";
import { Button } from "@/components/ui/button";

export default function InboxToolbar() {
  const [composeOpen, setComposeOpen] = useState(false);

  return (
    <>
      <div className="flex flex-wrap items-center justify-end gap-2 rounded-xl border border-zinc-200/80 bg-white p-4 shadow-[0_1px_3px_0_rgba(0,0,0,0.02)]">
        <Button
          type="button"
          variant="outline"
          className="h-9 rounded-lg border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50"
          onClick={() => setComposeOpen(true)}
        >
          <Send className="mr-2 h-5 w-5 text-slate-700" strokeWidth={2.1} />
          Send Message
        </Button>
      </div>

      {composeOpen && <ComposeMessagePopup fixedType="message" onClose={() => setComposeOpen(false)} />}
    </>
  );
}
