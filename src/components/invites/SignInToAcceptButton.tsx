"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";

export default function SignInToAcceptButton({
  token,
}: {
  token: string;
}) {
  const [loading, setLoading] = useState(false);

  async function signIn() {
    setLoading(true);

    const redirectTo =
      `${window.location.origin}/auth/callback?redirect=` +
      encodeURIComponent(`/invite/${token}`);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        queryParams: {
        prompt: "select_account",
      },
      },
    });

    if (error) {
      alert(error.message);
      setLoading(false);
    }
  }

  return (
    <button
      onClick={signIn}
      disabled={loading}
      className="rounded-lg bg-indigo-600 px-5 py-2.5 font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
    >
      {loading ? "Connecting..." : "Sign in to Accept"}
    </button>
  );
}