"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { MessageSquare, UserPlus } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { usePageHeader } from "@/components/layout/PageHeaderContext";
import { Button } from "@/components/ui/button";
import ComposeMessagePopup from "@/components/ComposeMessagePopup";

type TopBarProps = {
  sidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
};

export default function TopBar({ sidebarCollapsed, onToggleSidebar }: TopBarProps) {
  void sidebarCollapsed;
  void onToggleSidebar;
  const pathname = usePathname();
  const { pageHeader } = usePageHeader();

  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [composeMode, setComposeMode] = useState<"message" | "invite" | null>(null);

  useEffect(() => {
    async function loadUser(): Promise<void> {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) {
        console.error("Failed to load session:", error.message);
        return;
      }

      if (session?.user?.email) {
        setUserEmail(session.user.email);
      }
    }

    loadUser();
  }, []);

  const isOrgRoute = pathname.includes("/organizations/");
  const isTeamPage = isOrgRoute && pathname.includes("/team");
  const isInbox = isOrgRoute && pathname.includes("/inbox");

  if (!isOrgRoute) {
    return null;
  }

  const defaultHeaderContent = (
    <>
      <div className="w-10" />

      <div className="flex flex-1 justify-center">
        {isTeamPage && (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              className="h-9 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-50 shadow-sm hover:bg-zinc-800"
              onClick={() => setComposeMode("message")}
            >
              <MessageSquare className="mr-2 h-4 w-4 opacity-80" strokeWidth={2.5} />
              Send Message
            </Button>
            <Button
              type="button"
              className="h-9 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-50 shadow-sm hover:bg-zinc-800"
              onClick={() => setComposeMode("invite")}
            >
              <UserPlus className="mr-2 h-4 w-4 opacity-80" strokeWidth={2.5} />
              Send Invite
            </Button>
          </div>
        )}
        {!isTeamPage && isInbox && (
          <Button
            type="button"
            className="h-9 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-50 shadow-sm hover:bg-zinc-800"
            onClick={() => setComposeMode("message")}
          >
            Draft
          </Button>
        )}
      </div>

      <div className="w-10" />
    </>
  );

  return (
    <header className="sticky top-0 z-10 min-h-16 w-full shrink-0 border-b border-zinc-200/80 bg-white shadow-[0_1px_3px_0_rgba(0,0,0,0.02)]">
      <div className="mx-auto flex min-h-16 w-full max-w-5xl items-center px-6 py-3 lg:px-12">
        {pageHeader ? <div className="flex w-full items-center">{pageHeader}</div> : defaultHeaderContent}
      </div>

      {composeMode && (
        <ComposeMessagePopup
          userEmail={userEmail ?? ""}
          fixedType={composeMode}
          onClose={() => setComposeMode(null)}
        />
      )}
    </header>
  );
}
