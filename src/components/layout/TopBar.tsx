"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { MessageSquare, Send, UserPlus } from "lucide-react";
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
  const { pageHeader, canManageMembers } = usePageHeader();

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
      void session;
    }

    loadUser();
  }, []);

  const isOrgRoute = pathname.includes("/organizations/");
  const isTeamPage = isOrgRoute && pathname.includes("/team");
  const isInbox = isOrgRoute && pathname.includes("/inbox");
  const segments = pathname.split("/").filter(Boolean);
  
  const isProjectsPage =
    segments.length === 3 &&
    segments[0] === "organizations" &&
    segments[2] === "projects";

  const isProjectWorkspacePage =
  segments.length === 4 &&
  segments[0] === "organizations" &&
  segments[2] === "projects";

  const isEmployeeWorkspacePage =
  segments.length === 4 &&
  segments[0] === "organizations" &&
  segments[2] === "employees";

  if (isTeamPage) {
  return null;
  }
  if (!isOrgRoute) {
    return null;
  }
  if (isProjectsPage) {
    return null;
  }
  if (isProjectWorkspacePage) {
    return null;
  }
  if (isEmployeeWorkspacePage) {
    return null;
  }
return null;
//   const defaultHeaderContent = (
//     <>
//       <div className="w-10" />

//       <div className="flex flex-1 justify-center">
//         {isTeamPage && (
//           <div className="flex items-center gap-2">
//             <Button
//               type="button"
//               variant="outline"
//               className="h-9 rounded-lg border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50"
//               onClick={() => setComposeMode("message")}
//             >
//               <MessageSquare className="mr-2 h-4 w-4 text-zinc-500" strokeWidth={2.2} />
//               Send Message
//             </Button>
//             <Button
//               type="button"
//               variant="outline"
//               className="h-9 rounded-lg border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50"
//               onClick={() => setComposeMode("invite")}
//               disabled={!canManageMembers}
//               aria-disabled={!canManageMembers}
//             >
//               <UserPlus className="mr-2 h-4 w-4 text-zinc-500" strokeWidth={2.2} />
//               Send Invite
//             </Button>
//           </div>
//         )}
//         {!isTeamPage && isInbox && (
//           <Button
//             type="button"
//             variant="outline"
//             className="h-9 rounded-lg border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50"
//             onClick={() => setComposeMode("message")}
//           >
//             <Send
//               className="mr-2 h-5 w-5 text-slate-700"
//               strokeWidth={2.1}
//             />
//             Send Message
//           </Button>
//         )}
//       </div>

//       <div className="w-10" />
//     </>
//   );

//   return (
//     <header className="sticky top-0 z-10 min-h-16 w-full shrink-0 border-b border-zinc-200/80 bg-white shadow-[0_1px_3px_0_rgba(0,0,0,0.02)]">
//       <div className="mx-auto flex min-h-16 w-full max-w-5xl items-center px-6 py-3 lg:px-12">
//         {pageHeader ? <div className="flex w-full items-center">{pageHeader}</div> : defaultHeaderContent}
//       </div>

//       {composeMode && (
//         <ComposeMessagePopup
//           fixedType={composeMode}
//           onClose={() => setComposeMode(null)}
//         />
//       )}
//     </header>
//   );
}
