"use client";

import { useAuthEmployee } from "@/components/providers/Auth/AuthContext";

export default function AppGate({ children }: { children: React.ReactNode }) {
  const { hydrated } = useAuthEmployee();


  // wait until Supabase session + employee is loaded
  if (!hydrated) {
    return (
  <div style={{
    height: "100vh",
    background: "var(--background)"
  }} />
);

  }

  return <>{children}</>;
}
