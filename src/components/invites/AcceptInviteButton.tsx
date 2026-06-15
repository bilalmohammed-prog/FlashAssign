"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AcceptInviteButton({
  inviteId,
}: {
  inviteId: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function accept() {
    setLoading(true);

    const res = await fetch("/api/invites/accept", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        invite_id: inviteId,
      }),
    });

    const json = await res.json();

    if (!res.ok) {
      alert(json.error);
      setLoading(false);
      return;
    }

    router.push("/");
  }

  return (
    <button
      onClick={accept}
      disabled={loading}
      className="rounded-lg bg-indigo-600 px-5 py-2.5 text-white"
    >
      {loading ? "Accepting..." : "Accept Invitation"}
    </button>
  );
}