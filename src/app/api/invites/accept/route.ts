import { NextResponse } from "next/server";
import { z } from "zod";
import { fail } from "@/lib/api/response";
import { requireActionUser } from "@/actions/_helpers/requireOrgContext";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { uuidSchema } from "@/lib/validation/common";
import { addMember as addMemberService } from "@/services/organization/member.service";

const acceptInviteBodySchema = z.object({
  invite_id: uuidSchema,
}).strict();

export async function POST(req: Request) {
  try {
    let user, userId;
    try {
      ({ user, userId } = await requireActionUser());
    } catch (authErr) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const email = user.email?.toLowerCase().trim();
    if (!email) {
      return NextResponse.json({ error: "Account email is required to accept invites" }, { status: 400 });
    }

    const body = acceptInviteBodySchema.parse(await req.json());
    const { invite_id: inviteId } = body;

    const { data: invite, error: inviteError } = await supabaseAdmin
      .from("invites")
      .select("id, invite_email, organization_id, status, expires_at")
      .eq("id", inviteId)
      .maybeSingle();

    if (inviteError) {
      return NextResponse.json({ error: inviteError.message }, { status: 500 });
    }

    if (!invite) {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 });
    }

    if (invite.invite_email.toLowerCase().trim() !== email) {
      return NextResponse.json({ error: "This invite does not belong to your account" }, { status: 403 });
    }

    if (invite.status !== "pending") {
      return NextResponse.json({ error: `Invite is already ${invite.status}` }, { status: 400 });
    }

    if (new Date(invite.expires_at).getTime() <= Date.now()) {
      return NextResponse.json({ error: "Invite has expired" }, { status: 400 });
    }

    const { created } = await addMemberService(supabaseAdmin, {
      organizationId: invite.organization_id,
      userId,
      role: "employee",
      actorId: userId,
    });

    const now = new Date().toISOString();
    const { error: inviteUpdateError } = await supabaseAdmin
      .from("invites")
      .update({
        status: "accepted",
        accepted_at: now,
      })
      .eq("id", invite.id)
      .eq("status", "pending");

    if (inviteUpdateError) {
      return NextResponse.json({ error: inviteUpdateError.message }, { status: 500 });
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("active_organization_id")
      .eq("id", userId)
      .maybeSingle();

    if (!profile?.active_organization_id) {
      await supabaseAdmin
        .from("profiles")
        .upsert(
          {
            id: userId,
            active_organization_id: invite.organization_id,
          },
          { onConflict: "id" }
        );
    }

    return NextResponse.json({
      success: true,
      message: "Invite accepted",
      data: {
        inviteId: invite.id,
        organizationId: invite.organization_id,
        created,
      },
    });
  } catch (err) {
    console.error("Accept Invite Error:", err);
    return fail(err);
  }
}
