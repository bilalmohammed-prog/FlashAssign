"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Zap,
  ClipboardList,
  ChevronsRight,
  BrainCircuit,
  Users,
  Timer,
  CheckCircle2,
  TrendingUp,
  UserRoundCheck,
  Bot
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase/client";
import { CircuitDecor } from "./components/CircuitDecor";

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M17.64 9.2a10.3 10.3 0 0 0-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#FF3D00"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.94v2.32A9 9 0 0 0 9 18Z"
        opacity="0"
      />
      <path
        fill="#4CAF50"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.94v2.32A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#1976D2"
        d="M3.97 10.72A5.41 5.41 0 0 1 3.68 9c0-.6.1-1.18.27-1.72V4.96H.94A9 9 0 0 0 0 9c0 1.45.35 2.82.94 4.04l3.03-2.32Z"
      />
      <path
        fill="#1976D2"
        d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58A9 9 0 0 0 9 0 9 9 0 0 0 .94 4.96l3.03 2.32C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}
function ChainStep({
  icon: Icon,
  label,
  highlight = false,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={
        "flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors " +
        (highlight
          ? "bg-brand/10 text-brand"
          : "text-foreground/85")
      }
    >
      <Icon className="h-4 w-4" strokeWidth={2} />
      {label}
    </div>
  );
}

function ChainArrow() {
  return (
    <div className="flex items-center text-foreground/25">
      <ChevronsRight className="h-3.5 w-3.5" />
    </div>
  );
}
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
      safeRedirect,
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
    <main className="relative min-h-screen overflow-hidden bg-background">
      {/* Background engineering decor */}
      <CircuitDecor
        position="tr"
        className="pointer-events-none absolute -right-16 -top-16 h-[340px] w-[440px] text-brand/20"
      />
      <CircuitDecor
        position="br"
        className="pointer-events-none absolute -bottom-16 -right-16 h-[340px] w-[440px] text-brand/20"
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-6 lg:px-10">
        {/* Nav */}
        <header className="flex items-center justify-between py-4 mt-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-brand-foreground shadow-brand">
              <Zap className="h-5 w-5" strokeWidth={2.5} />
            </div>
            <span className="font-display text-[22px] font-semibold tracking-tight text-foreground">
              FlashAssign
            </span>
          </div>
          
        </header>

        {/* Hero — true split-screen */}
        <section className="grid min-h-[calc(100vh-120px)] flex-1 items-center gap-8 py-5 md:grid-cols-[57fr_43fr] md:gap-9 lg:gap-14 lg:py-6">
          {/* Left */}
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-brand backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-brand" />
              Instant work allocation tool
            </div>

            <h1 className="mt-4 font-display text-[38px] font-semibold leading-[1.06] tracking-[-0.025em] text-foreground sm:text-[46px] lg:text-[54px]">
              One-click task allocation.
              <br />
              <span className="text-[0.65em] font-medium text-foreground/55">
    Fast, lightweight workload orchestration.
  </span>
            </h1>

            <p className="mt-4 max-w-xl text-[15.5px] leading-relaxed text-muted-foreground">
              Stop dragging tickets. Define team roles, create tasks, and let FlashAssign generate
              optimal assignments automatically. Review and approve in seconds.
            </p>

            {/* Workflow */}
            <div className="mt-6">
              <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                How it works
              </div>
              <div className="relative mt-3 overflow-hidden rounded-2xl border border-border bg-card/60 shadow-card backdrop-blur">

  <div className="flex flex-wrap items-center">

    <ChainStep icon={Users} label="Define Team Roles" />

    <ChainArrow />

    <ChainStep icon={ClipboardList} label="Create Tasks" />

    <ChainArrow />

    <ChainStep icon={CheckCircle2} label="Assign Requirements" />

    <ChainArrow />

    <ChainStep
      icon={BrainCircuit}
      label="Allocation Engine"
      highlight
    />

    <ChainArrow />

    <ChainStep icon={TrendingUp} label="Review" />

  </div>
</div>
            </div>

            {/* Metrics */}
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Metric icon={Timer} label="Allocation Speed" value="< 10s" tone="brand" />
              <Metric icon={Bot} label="Assignment Logic" value="Algorithmic" tone="neutral" />
              <Metric icon={UserRoundCheck} label="Final Assignment" value="Human Reviewed" tone="success" />
            </div>

            <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
              Built for fast-paced dev teams
            </div>
          </div>

          {/* Right — Auth card */}
<div id="signin" className="md:justify-self-end md:pt-4">
  <div className="relative w-full max-w-[420px]">
    <div className="absolute -inset-px -z-10 rounded-2xl bg-gradient-to-b from-border/60 to-transparent" />
    <div className="rounded-2xl border border-border/80 bg-card/90 p-7 shadow-[0_28px_60px_-44px_rgba(15,23,42,0.55)] backdrop-blur">
      
      <h2 className="mt-3.5 font-display text-2xl font-semibold tracking-tight text-foreground">
        Get started
      </h2>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Sign in with Google to access or create your workspace.
      </p>

      {oauthError && (
        <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs font-medium text-destructive">
          {oauthError}
        </p>
      )}

      <Button
        size="lg"
        type="button"
        variant="outline"
        onClick={() => {
          void handleGoogleSignIn();
        }}
        disabled={oauthPending}
        className="mt-6 h-12 w-full gap-3 rounded-lg bg-background border-border hover:bg-muted text-base font-medium text-foreground transition-all disabled:opacity-70"
      >
        {oauthPending ? (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
        ) : (
          <GoogleIcon />
        )}
        {oauthPending ? "Connecting..." : "Continue with Google"}
      </Button>

      <p className="mt-5 text-center text-xs leading-relaxed text-muted-foreground">
        By continuing, you agree to our{" "}
        <a href="#" className="text-foreground/80 underline-offset-4 hover:underline">
          Terms
        </a>{" "}
        and{" "}
        <a href="#" className="text-foreground/80 underline-offset-4 hover:underline">
          Privacy Policy
        </a>
        .
      </p>
    </div>
  </div>
</div>
        </section>

        
      </div>
    </main>
  );
}


function WorkflowStep({
  icon: Icon,
  label,
  highlight = false,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={
        "flex items-center gap-2.5 rounded-lg border border-border/70 px-3 py-2 text-sm font-medium shadow-sm transition-colors " +
        (highlight
          ? "bg-brand-soft text-brand ring-1 ring-brand/10"
          : "bg-background/70 text-foreground/85")
      }
    >
      <Icon className="h-4 w-4" strokeWidth={2} />
      {label}
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  value: string;
  tone: "brand" | "success" | "neutral";
}) {
  const toneClass =
    tone === "brand"
      ? "text-brand"
      : tone === "success"
        ? "text-success"
        : "text-foreground";
  return (
    <div className="group rounded-xl border border-border/80 bg-card/70 p-4 shadow-[0_16px_36px_-30px_rgba(15,23,42,0.45)] transition-shadow hover:shadow-[0_20px_44px_-32px_rgba(15,23,42,0.5)]">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </span>
        <Icon className={"h-4 w-4 " + toneClass} strokeWidth={2} />
      </div>
      <div
        className={
          "mt-2 font-display text-[22px] font-semibold tracking-tight " + toneClass
        }
      >
        {value}
      </div>
    </div>
  );
}
