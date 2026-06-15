
import { supabaseAdmin } from "@/lib/supabase/admin";
import { CalendarDays, Mail, MessageSquare, UserRound, Zap } from "lucide-react";
import Link from "next/link";
import { getSupabaseServer } from "@/lib/supabase/server";
import AcceptInviteButton from "@/components/invites/AcceptInviteButton";
import DeclineInviteButton from "@/components/invites/DeclineInviteButton";
import SignInToAcceptButton from "@/components/invites/SignInToAcceptButton";


type Props = {
  params: Promise<{ token: string }>;
};

export default async function InvitePage({ params }: Props) {
    const { token } = await params;
    const supabase = await getSupabaseServer();
    const {
  data: { user },
} = await supabase.auth.getUser();

const loggedIn = !!user;
  const { data: invite, error } = await supabaseAdmin
    .from("invites")
    .select("*")
    .eq("token", token)
    .maybeSingle();
    console.log("Invite:", invite);
    console.log("Error:", error);

  if (error) throw error;

  if (!invite) {
    return (
      <main className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
        <div className="max-w-lg w-full rounded-2xl border bg-white p-10 text-center shadow-sm">
          <Zap className="mx-auto h-8 w-8" />
          <h1 className="mt-6 text-3xl font-bold">Invalid invitation</h1>
          <p className="mt-3 text-zinc-500">
            This invitation doesn&apos;t exist or has been removed.
          </p>
          <Link
            href="/auth/login"
            className="mt-8 inline-flex rounded-lg bg-indigo-600 px-5 py-2.5 text-white"
          >
            Go to Login
          </Link>
        </div>
      </main>
    );
  }

  const expired =
    invite.expires_at &&
    new Date(invite.expires_at) < new Date();

  if (expired) {
    return (
      <main className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
        <div className="max-w-lg w-full rounded-2xl border bg-white p-10 text-center shadow-sm">
          <Zap className="mx-auto h-8 w-8" />
          <h1 className="mt-6 text-3xl font-bold">Invitation expired</h1>
          <p className="mt-3 text-zinc-500">
            Please ask the organization owner to send you another invitation.
          </p>
        </div>
      </main>
    );
  }

  if (invite.status === "accepted") {
    return (
      <main className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
        <div className="max-w-lg w-full rounded-2xl border bg-white p-10 text-center shadow-sm">
          <Zap className="mx-auto h-8 w-8" />
          <h1 className="mt-6 text-3xl font-bold">
            Invitation already accepted
          </h1>
          <p className="mt-3 text-zinc-500">
            This invitation has already been used.
          </p>
        </div>
      </main>
    );
  }
  if (invite.status === "declined") {
  return (
    <main className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
      <div className="max-w-lg w-full rounded-2xl border bg-white p-10 text-center shadow-sm">
        <Zap className="mx-auto h-8 w-8" />
        <h1 className="mt-6 text-3xl font-bold">
          Invitation declined
        </h1>
        <p className="mt-3 text-zinc-500">
          You&apos;ve declined this invitation. If this was a mistake, ask the organization owner to send you a new invitation.
        </p>
      </div>
    </main>
  );
}

  return (
    <main className="min-h-screen bg-zinc-50 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-2xl">
        <div className="mb-10 text-center">
          <div className="inline-flex items-center gap-2 font-semibold text-xl">
            <Zap className="h-5 w-5" />
            FlashAssign
          </div>

          <h1 className="mt-6 text-4xl font-bold tracking-tight">
            You&apos;ve been invited
          </h1>

          <p className="mt-3 text-zinc-500 text-lg">
            Review the invitation below before joining the organization.
          </p>
        </div>

        <div className="rounded-2xl border bg-white shadow-sm">
          <div className="border-b px-8 py-6">
            <h2 className="text-xl font-semibold">Invitation Details</h2>
          </div>

          <div className="space-y-8 p-8">
            <div className="flex gap-4">
              <UserRound className="mt-1 h-5 w-5 text-zinc-500" />
              <div>
                <p className="text-sm text-zinc-500">Invited Email</p>
                <p className="font-medium">{invite.invite_email}</p>
              </div>
            </div>

            <div className="flex gap-4">
              <MessageSquare className="mt-1 h-5 w-5 text-zinc-500" />
              <div>
                <p className="text-sm text-zinc-500">Personal Message</p>
                <p className="whitespace-pre-wrap">{invite.content}</p>
              </div>
            </div>

            <div className="flex gap-4">
              <CalendarDays className="mt-1 h-5 w-5 text-zinc-500" />
              <div>
                <p className="text-sm text-zinc-500">Expires</p>
                <p>{new Date(invite.expires_at).toLocaleDateString()}</p>
              </div>
            </div>

            <div className="flex gap-4">
              <Mail className="mt-1 h-5 w-5 text-zinc-500" />
              <div>
                <p className="text-sm text-zinc-500">Status</p>
                <span className="rounded-full border bg-amber-50 px-3 py-1 text-sm text-amber-700">
                  {invite.status}
                </span>
              </div>
            </div>
          </div>

            <div className="flex flex-col-reverse gap-3 border-t p-8 sm:flex-row sm:justify-end">
                <DeclineInviteButton token={token} />

                {loggedIn ? (
                    <AcceptInviteButton inviteId={invite.id} />
                ) : (
                    <SignInToAcceptButton token={token} />
                )}
            </div>
        </div>
      </div>
    </main>
  );
}