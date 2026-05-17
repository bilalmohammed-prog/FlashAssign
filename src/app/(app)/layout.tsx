"use client";

import { useEffect, useState } from "react";
import { DashboardProvider, useDashboard } from "@/components/providers/dashboard/DashboardContext";
import LeftSideBar from "@/components/layout/LeftSideBar";
import { PageHeaderProvider } from "@/components/layout/PageHeaderContext";
import TopBar from "@/components/layout/TopBar";
import { supabase } from "@/lib/supabase/client";
import { ToastProvider, ToastContainer } from "@/components/providers/toast";

interface DashboardShellProps {
  children: React.ReactNode;
}

function DashboardShell({ children }: DashboardShellProps) {
  const { setCurrentUserId } = useDashboard();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    async function loadUser(): Promise<void> {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      // Use profiles instead of empid
      const { data } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();

      if (data?.id) {
        setCurrentUserId(data.id);
      }
    }

    loadUser();
  }, [setCurrentUserId]);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-zinc-50 font-sans text-zinc-900">
      <LeftSideBar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((current) => !current)}
      />
      <PageHeaderProvider>
        <div className="relative flex min-w-0 flex-1 flex-col">
          <TopBar
            sidebarCollapsed={sidebarCollapsed}
            onToggleSidebar={() => setSidebarCollapsed((current) => !current)}
          />
          <main className="relative mx-auto flex-1 w-full max-w-5xl overflow-y-auto px-6 py-12 lg:px-12">
            {children}
          </main>
        </div>
      </PageHeaderProvider>
      <ToastContainer />
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <DashboardProvider>
        <DashboardShell>{children}</DashboardShell>
      </DashboardProvider>
    </ToastProvider>
  );
}
