"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function DeclineInviteButton({
  token,
}: {
  token: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function decline() {
    setLoading(true);

    const res = await fetch("/api/invites/decline", {
    method: "POST",
    body: JSON.stringify({
        token,
    }),
});

    const json = await res.json();

    if (!res.ok) {
    alert(json.error);
    setLoading(false);
    return;
    }

    setLoading(false);
    router.refresh();
  }

  return (
    <button
      onClick={decline}
      disabled={loading}
      className="rounded-lg border px-5 py-2.5 font-medium hover:bg-zinc-50 disabled:opacity-50"
    >
      {loading ? "Declining..." : "Decline"}
    </button>
  );
}