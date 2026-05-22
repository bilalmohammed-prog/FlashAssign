"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/lib/supabase/client";

export type AuthEmployee = {
  id: string;
  full_name: string | null;
};

interface AuthEmployeeContextType {
  employee: AuthEmployee | null;
  setEmployee: (employee: AuthEmployee | null) => void;
  hydrated: boolean;
  setHydrated: (v: boolean) => void;
}

const AuthEmployeeContext =
  createContext<AuthEmployeeContextType | undefined>(undefined);

export function AuthEmployeeProvider({ children }: { children: ReactNode }) {
  const [employee, setEmployee] = useState<AuthEmployee | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function fetchEmployee() {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error || !user) {
        if (mounted) {
          setEmployee(null);
          setHydrated(true);
        }
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("id", user.id)
        .maybeSingle();

      if (mounted) {
        setEmployee(data ?? null);
        setHydrated(true);
      }
    }

    // Initial load
    fetchEmployee();

    // Listen for login/logout
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      fetchEmployee();
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthEmployeeContext.Provider
      value={{
        employee,
        setEmployee,
        hydrated,
        setHydrated,
      }}
    >
      {children}
    </AuthEmployeeContext.Provider>
  );
}

export function useAuthEmployee(): AuthEmployeeContextType {
  const ctx = useContext(AuthEmployeeContext);
  if (!ctx) {
    throw new Error("useAuthEmployee must be used inside AuthEmployeeProvider");
  }
  return ctx;
}
