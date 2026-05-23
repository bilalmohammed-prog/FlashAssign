"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useAuthEmployee } from "@/components/providers/Auth/AuthContext";

type ProfileMenuProps = {
  collapsed?: boolean;
};

export default function ProfileMenu({ collapsed = false }: ProfileMenuProps) {
  const [email, setEmail] = useState("");
  const { employee } = useAuthEmployee();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [metaName, setMetaName] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setMetaName(data.user?.user_metadata?.full_name || "");
      setEmail(data.user?.email || "");
    });
  }, []);

  const displayName = employee?.full_name || metaName || "User";
  const initials = displayName.charAt(0).toUpperCase();

  useEffect(() => {
    function handleGlobalEvents(e: MouseEvent | KeyboardEvent): void {
      if (e instanceof MouseEvent) {
        if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
          setOpen(false);
        }
      }
      if (e instanceof KeyboardEvent && e.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleGlobalEvents);
    document.addEventListener("keydown", handleGlobalEvents);
    return () => {
      document.removeEventListener("mousedown", handleGlobalEvents);
      document.removeEventListener("keydown", handleGlobalEvents);
    };
  }, []);


  async function handleLogout(): Promise<void> {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="true"
        aria-expanded={open}
        className={`group flex w-full rounded-lg p-2 text-left transition-colors hover:bg-zinc-50 ${
          collapsed ? "justify-center" : "items-center gap-3"
        }`}
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 bg-zinc-100 text-sm font-semibold text-zinc-700 shadow-sm">
          {initials}
        </div>
        {!collapsed && (
          <div className="flex min-w-0 flex-col text-sm">
            <span className="truncate font-medium text-zinc-900">{displayName}</span>
            <span className="truncate text-xs text-zinc-500">
              {email || employee?.id || "User"}
            </span>
          </div>
        )}
      </button>

      <div
        role="menu"
        className={`absolute bottom-[calc(100%+16px)] z-[99999] flex w-[280px] max-w-[90vw] flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-lg transition-all duration-200 ${
          collapsed ? "left-0" : "left-0"
        } ${
          open ? "visible translate-y-0 opacity-100" : "invisible translate-y-3 opacity-0"
        }`}
      >
        <div className="space-y-1">
          <p className="text-base font-semibold text-zinc-900">{displayName}</p>
          <p className="break-all text-sm text-zinc-500">{email}</p>
          <span className="inline-flex items-center rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-600">
            ID: {employee?.id || "Loading..."}
          </span>
        </div>

        <button
          onClick={handleLogout}
          role="menuitem"
          className="w-full rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-50"
        >
          Logout
        </button>
      </div>
    </div>
  );
}
