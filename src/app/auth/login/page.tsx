"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loginAction, type LoginState } from "@/actions/auth/login";
const initialState: LoginState = { error: null };

export default function LoginPage() {
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get("redirect") ?? "";
  const [state, formAction, isPending] = useActionState(loginAction, initialState);
  const [stats, setStats] = useState({ organizations: 8, activeTasks: 148 });

  useEffect(() => {
    fetch("/api/public/stats")
      .then((response) => response.json())
      .then((data) => setStats(data))
      .catch(() => {});
  }, []);
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

            <form action={formAction} className="mt-8 space-y-6">
              <input type="hidden" name="redirect" value={redirectParam} />
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700" htmlFor="email">
                  Email
                </label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="name@company.com"
                  autoComplete="email"
                  required
                  className="h-11 rounded-md border border-slate-300 bg-white text-sm text-slate-900 shadow-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-slate-700" htmlFor="password">
                    Password
                  </label>
                  <Link href="#" className="text-xs text-indigo-600 hover:underline">
                    Forgot password?
                  </Link>
                </div>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                  className="h-11 rounded-md border border-slate-300 bg-white text-sm text-slate-900 shadow-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                />
              </div>

              {state.error && (
                <p className="text-sm font-medium text-red-600">{state.error}</p>
              )}

              <Button
                type="submit"
                disabled={isPending}
                className="h-11 w-full rounded-md bg-indigo-600 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                {isPending ? "Signing in…" : "Sign in"}
              </Button>

              <Button
                type="button"
                variant="outline"
                className="h-11 w-full rounded-md border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Request Demo
              </Button>
            </form>

            <p className="mt-8 text-center text-sm text-slate-600">
              New to the platform?{" "}
              <Link href="/auth/signup" className="font-medium text-indigo-600">
                Create an account
              </Link>
            </p>
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
