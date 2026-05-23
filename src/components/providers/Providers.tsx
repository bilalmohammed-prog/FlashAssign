"use client";

import type { ReactNode } from "react";
import { DashboardProvider } from "@/components/providers/dashboard/DashboardContext";
import { AuthEmployeeProvider } from "@/components/providers/Auth/AuthContext";
import AppGate from "@/components/providers/Auth/AppGate";

interface ProvidersProps {
  children: ReactNode;
}

export default function Providers({ children }: ProvidersProps) {
  return (
    <AuthEmployeeProvider>
      <AppGate>
        <DashboardProvider>
          {children}
        </DashboardProvider>
      </AppGate>
    </AuthEmployeeProvider>
  );
}