"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/api/client";
import { ApiException } from "@/lib/api/types";
import { Button } from "@/components/ui/button";

type Props = {
  userEmail: string;
  onClose: () => void;
  fixedType: "message" | "invite";
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ComposeMessagePopup({ userEmail, onClose, fixedType }: Props) {
  void userEmail;
  const { orgId } = useParams<{ orgId: string }>();
  const [recipient, setRecipient] = useState("");
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const isInvite = fixedType === "invite";

  async function handleSend() {
    if (!recipient.trim() || !content.trim()) return;

    if (isInvite && !EMAIL_PATTERN.test(recipient.trim())) {
      setError("Enter a valid invite email.");
      return;
    }

    if (!isInvite && !UUID_PATTERN.test(recipient.trim())) {
      setError("Recipient User ID must be a valid UUID.");
      return;
    }

    if (!orgId) {
      setError("Organization context is missing. Refresh and try again.");
      return;
    }

    try {
      setSending(true);
      setError(null);

      const endpoint = isInvite ? "/api/invites/send" : "/api/messages/send";
      const body = isInvite
        ? {
            organizationId: orgId,
            inviteEmail: recipient.trim(),
            content: content.trim(),
          }
        : {
            organizationId: orgId,
            recipientId: recipient.trim(),
            content: content.trim(),
          };

      await apiFetch(endpoint, {
        method: "POST",
        body: JSON.stringify(body),
      });

      setSuccess(true);
      setTimeout(() => onClose(), 1000);
    } catch (err) {
      if (err instanceof ApiException) {
        setError(err.message);
      } else {
        setError(isInvite ? "Failed to send invite." : "Failed to send message.");
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-[440px] space-y-4 rounded-xl border border-border bg-card p-6 shadow-sm">
        <h3 className="text-base font-semibold text-foreground">
          {isInvite ? "Send Invite" : "New Message"}
        </h3>

        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">
            {isInvite ? "Invite Email" : "Recipient User ID"}
          </label>
          <input
            placeholder={isInvite ? "teammate@company.com" : "Paste recipient UUID"}
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            type={isInvite ? "email" : "text"}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">
            Message
          </label>
          <textarea
            placeholder="Write your message…"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
            className="min-h-24 w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        {error && (
          <p className="text-xs text-destructive">{error}</p>
        )}

        {success && (
          <p className="text-xs text-green-600">{isInvite ? "Invite sent!" : "Message sent!"}</p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={sending}>
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={!recipient.trim() || !content.trim() || sending}
          >
            {sending ? "Sending..." : "Send"}
          </Button>
        </div>
      </div>
    </div>
  );
}
