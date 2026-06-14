"use client";

import { useEffect, useRef, useState } from "react";
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
  // POSSIBLE LARGE CLIENT COMPONENT
  const hydrationStartRef = useRef<number | null>(null);
  const renderCountRef = useRef(0);

  useEffect(() => {
    hydrationStartRef.current = performance.now();
    console.time("[perf] layout dashboard hydration");
    console.timeEnd("[perf] layout dashboard hydration");
  }, []);

  useEffect(() => {
    renderCountRef.current += 1;
    if (renderCountRef.current > 1) {
      console.info(
        `[render] layout dashboard #${renderCountRef.current} sidebarCollapsed=${sidebarCollapsed}`
      );
    }
  });

  useEffect(() => {
    async function loadUser(): Promise<void> {
      // DUPLICATE CONTEXT LOAD
      // This client-side layout lookup runs in addition to page/action context loading.
      console.time("[Fetch] dashboard layout profile flow");
      const fetchStart = performance.now();
      console.time("[DB] auth/session dashboard layout");
      const {
        data: { user },
      } = await supabase.auth.getUser();
      console.timeEnd("[DB] auth/session dashboard layout");

      if (!user) {
        console.info(`[perf] layout dashboard auth user ${performance.now() - fetchStart}ms`);
        console.timeEnd("[Fetch] dashboard layout profile flow");
        return;
      }

      // Use profiles instead of empid
      console.time("[DB] profile lookup dashboard layout");
      const { data } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();
      console.timeEnd("[DB] profile lookup dashboard layout");

      console.info(`[perf] layout dashboard profile lookup ${performance.now() - fetchStart}ms`);
      console.timeEnd("[Fetch] dashboard layout profile flow");

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
          <main className="relative flex-1 w-full overflow-y-auto px-6 py-12 lg:px-12">
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
