"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase/client";

const workflowSteps: { label: string; icon: JSX.Element }[] = [
  {
    label: "Tasks",
    icon: (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      >
        <path d="M7 7h10" />
        <path d="M7 12h10" />
        <path d="M7 17h6" />
        <rect x="4" y="4" width="16" height="16" rx="3" />
      </svg>
    ),
  },
  {
    label: "Allocation Engine",
    icon: (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      >
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.2a2 2 0 0 1-2.8 2.8l-.2-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.3a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.2.1a2 2 0 0 1-2.8-2.8l.1-.2a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.3a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.2a2 2 0 0 1 2.8-2.8l.2.1a1.7 1.7 0 0 0 1.8.3h0A1.7 1.7 0 0 0 10 3.3V3a2 2 0 0 1 4 0v.3a1.7 1.7 0 0 0 1 1.5h0a1.7 1.7 0 0 0 1.8-.3l.2-.1a2 2 0 0 1 2.8 2.8l-.1.2a1.7 1.7 0 0 0-.3 1.8v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.3a1.7 1.7 0 0 0-1.5 1Z" />
      </svg>
    ),
  },
  {
    label: "Team",
    icon: (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      >
        <path d="M17 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
        <path d="M7 11a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
        <path d="M23 11a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
        <path d="M6 20v-1a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v1" />
        <path d="M1 20v-1a4 4 0 0 1 4-4" />
        <path d="M23 20v-1a4 4 0 0 0-4-4" />
      </svg>
    ),
  },
];

const metrics: { label: string; value: string }[] = [
  { label: "Allocation Speed", value: "< 1s" },
  { label: "Logic", value: "Deterministic" },
  { label: "Planning Time Saved", value: "85%" },
];

export default function LoginPage() {
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get("redirect") ?? "";
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [oauthPending, setOauthPending] = useState(false);

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
    <main className="relative min-h-screen overflow-hidden bg-[#F6F6F9] text-slate-900">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-0 h-96 w-96 rounded-full bg-[radial-gradient(circle_at_center,rgba(91,61,245,0.08),transparent_70%)]" />
        <div className="absolute -right-32 top-12 h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle_at_center,rgba(91,61,245,0.06),transparent_70%)]" />
        <svg
          aria-hidden="true"
          viewBox="0 0 420 260"
          className="absolute left-0 top-0 h-48 w-72 text-[#C9C3F4]"
        >
          <path
            d="M10 40h80m40 0h90m40 0h100M50 40v50m120-50v70m120-70v40"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
          <circle cx="50" cy="90" r="3" fill="currentColor" />
          <circle cx="170" cy="110" r="3" fill="currentColor" />
          <circle cx="290" cy="80" r="3" fill="currentColor" />
        </svg>
        <svg
          aria-hidden="true"
          viewBox="0 0 380 260"
          className="absolute right-0 top-0 h-56 w-72 text-[#CDC8F5]"
        >
          <circle cx="280" cy="80" r="28" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <circle cx="320" cy="120" r="18" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <circle cx="250" cy="140" r="22" fill="none" stroke="currentColor" strokeWidth="1.4" />
        </svg>
        <svg
          aria-hidden="true"
          viewBox="0 0 420 260"
          className="absolute bottom-0 right-0 h-52 w-80 text-[#C9C3F4]"
        >
          <path
            d="M40 220h90m40 0h100m40 0h100M130 220v-50m120 50v-60m120 60v-40"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
          <circle cx="130" cy="170" r="3" fill="currentColor" />
          <circle cx="250" cy="160" r="3" fill="currentColor" />
          <circle cx="370" cy="180" r="3" fill="currentColor" />
        </svg>
      </div>

      <section className="relative mx-auto flex min-h-[calc(100vh-120px)] w-full max-w-6xl flex-col gap-14 px-6 py-16 lg:flex-row lg:items-center lg:gap-10">
        <div className="w-full lg:w-[58%]">
          <div className="mb-10 inline-flex items-center rounded-full border border-[#E4E1F7] bg-white/70 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-[#5B3DF5] shadow-sm">
            AI-POWERED SPRINT PLANNING FOR DEV TEAMS
          </div>

          <h1 className="max-w-xl text-4xl font-semibold leading-tight tracking-tight text-slate-900 md:text-5xl">
            One-click sprint planning.
            <br />
            Deterministic task allocation.
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-slate-600">
            Stop dragging tickets. Define team roles, import tasks, and let FlashAssign generate
            optimal sprint assignments automatically. Review and approve in seconds.
          </p>

          <div className="mt-10 flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#5B3DF5] text-white shadow-[0_18px_40px_-24px_rgba(91,61,245,0.8)]">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-8 w-8" fill="currentColor">
                <path d="M13 2 6 13h5l-1 9 7-11h-5l1-9Z" />
              </svg>
            </div>
            <div>
              <div className="text-xl font-semibold text-[#3E2ECC]">FlashAssign</div>
              <div className="text-sm text-slate-500">Plan smarter. Deliver faster.</div>
            </div>
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            {workflowSteps.map((step, index) => (
              <div key={step.label} className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#E4E1F7] bg-white text-[#5B3DF5] shadow-sm">
                  {step.icon}
                </div>
                <div className="text-sm font-medium text-slate-700">{step.label}</div>
                {index < workflowSteps.length - 1 && (
                  <span className="text-base text-[#B6B0E9]">→</span>
                )}
              </div>
            ))}
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {metrics.map((metric) => (
              <div
                key={metric.label}
                className="rounded-2xl border border-[#E9E7F8] bg-white/80 p-4 shadow-[0_16px_40px_-28px_rgba(91,61,245,0.6)]"
              >
                <div className="text-xs uppercase tracking-wide text-slate-500">
                  {metric.label}
                </div>
                <div className="mt-2 text-lg font-semibold text-slate-900">
                  {metric.value}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 text-xs text-slate-500">
            Built for engineering teams. Trusted by builders.
          </div>
        </div>

        <div className="flex w-full items-center justify-center lg:w-[42%]">
          <div className="w-full max-w-sm rounded-3xl border border-[#E7E4F8] bg-white p-8 shadow-[0_40px_80px_-60px_rgba(91,61,245,0.8)]">
            <div className="text-xl font-semibold text-slate-900">Get started</div>
            <div className="mt-2 text-sm text-slate-500">Sign in to your workspace.</div>

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
                className="h-12 w-full rounded-xl bg-[#5B3DF5] text-sm font-semibold text-white shadow-[0_18px_40px_-24px_rgba(91,61,245,0.8)] hover:bg-[#4B32E3]"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white">
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4">
                    <path
                      d="M21.5 12.2c0-.7-.1-1.4-.3-2H12v3.8h5.3a4.5 4.5 0 0 1-2 3v2.5h3.2c1.9-1.8 3-4.3 3-7.3Z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 22c2.7 0 5-1 6.7-2.7l-3.2-2.5c-.9.6-2 1-3.5 1-2.6 0-4.9-1.8-5.7-4.2H2.9v2.6A10 10 0 0 0 12 22Z"
                      fill="#34A853"
                    />
                    <path
                      d="M6.3 13.6a6 6 0 0 1 0-3.2V7.8H2.9a10 10 0 0 0 0 8.4l3.4-2.6Z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 6.6c1.4 0 2.6.5 3.6 1.4l2.7-2.7A9.8 9.8 0 0 0 12 2a10 10 0 0 0-9.1 5.8l3.4 2.6C7.1 8.3 9.4 6.6 12 6.6Z"
                      fill="#EA4335"
                    />
                  </svg>
                </span>
                {oauthPending ? "Connecting..." : "Continue with Google"}
              </Button>
              <p className="text-center text-xs text-slate-400">
                No password required.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
