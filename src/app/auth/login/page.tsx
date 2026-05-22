"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase/client";

export default function LoginPage() {
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get("redirect") ?? "";
  const [stats, setStats] = useState({ organizations: 8, activeTasks: 148 });
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [oauthPending, setOauthPending] = useState(false);

  useEffect(() => {
    fetch("/api/public/stats")
      .then((response) => response.json())
      .then((data) => setStats(data))
      .catch(() => {});
  }, []);

  const safeRedirect = (() => {
    if (!redirectParam || !redirectParam.startsWith("/") || redirectParam.startsWith("//")) {
      return "/";
    }
    return redirectParam;
  })();

  async function handleGoogleSignIn() {
    setOauthPending(true);
    setOauthError(null);

    const redirectTo = `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(
      safeRedirect
    )}`;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
      },
    });

    if (error) {
      setOauthError(error.message);
      setOauthPending(false);
    }
  }
  return (
    <main className="min-h-screen w-full bg-white text-slate-900">
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col lg:flex-row">
        <div className="w-full bg-slate-50 p-8 lg:w-[45%] lg:p-12">
          <div className="flex h-full flex-col justify-between gap-16">
            <div>
              <div className="inline-flex items-center gap-3 pb-16">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600">
                  <span className="text-sm font-semibold text-white">RO</span>
                </div>
                <div>
                  <h1 className="text-lg font-semibold">ResourceOS</h1>
                  <p className="text-sm text-slate-600">Workspace Intelligence</p>
                </div>
              </div>

              <div className="max-w-md">
                <span className="text-xs font-medium uppercase tracking-wide text-indigo-600">
                  Operational Command Center
                </span>
                <h2 className="mt-4 text-4xl font-semibold leading-tight tracking-tight">
                  Plan work.
                  <br />
                  Align teams.
                  <br />
                  Deliver outcomes.
                </h2>
                <p className="mt-6 text-base leading-relaxed text-slate-600">
                  ResourceOS gives every organization one shared surface for tasks,
                  assignments, and execution velocity.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-6">
              <MetricCard label="Teams" value={String(stats.organizations)} />
              <MetricCard label="Active Tasks" value={String(stats.activeTasks)} />
              <MetricCard label="On-time Rate" value="94%" />
            </div>
          </div>
        </div>

        <div className="flex w-full items-center justify-center p-8 lg:w-[55%] lg:p-12">
          <div className="w-full max-w-sm">
            <h2 className="text-2xl font-semibold">Welcome back</h2>
            <p className="mt-2 text-sm text-slate-600">
              Enter your credentials to continue.
            </p>

            <div className="mt-8 space-y-4">
              {oauthError && (
                <p className="text-sm font-medium text-red-600">{oauthError}</p>
              )}
              <Button
                type="button"
                onClick={() => {
                  void handleGoogleSignIn();
                }}
                disabled={oauthPending}
                className="h-11 w-full rounded-md bg-indigo-600 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                {oauthPending ? "Connecting..." : "Continue with Google"}
              </Button>
              <p className="text-center text-xs text-slate-500">
                Google OAuth only. Password login is disabled.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200/70 bg-white px-3 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.06)]">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}
