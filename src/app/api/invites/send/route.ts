import { randomBytes } from "crypto";
import { z } from "zod";
import { fail, ok } from "@/lib/api/response";
import { authorize } from "@/lib/auth/authorization";
import { requireTenantContext } from "@/lib/auth/tenant-context";
import { uuidSchema } from "@/lib/validation/common";
import { sendInviteEmail } from "@/lib/email/sendInviteEmail";

const sendInviteSchema = z.object({
  organizationId: uuidSchema.optional(),
  inviteEmail: z.string().trim().email(),
  content: z.string().trim().min(1).max(4000),
});

export async function POST(req: Request) {
  try {
    const payload = sendInviteSchema.parse(await req.json());

    const tenant = await requireTenantContext(req, {
      organizationId: payload.organizationId,
    });

    authorize("manage_members", "organization", tenant);

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await tenant.supabase
      .from("invites")
      .insert({
        organization_id: tenant.organizationId,
        inviter_id: tenant.userId,
        invite_email: payload.inviteEmail.toLowerCase().trim(),
        content: payload.content,
        token,
        status: "pending",
        expires_at: expiresAt,
      })
      .select("id,invite_email,status,expires_at")
      .maybeSingle();

    if (error) {
    throw error;
}

      await sendInviteEmail({
          email: payload.inviteEmail,
          token,
          organizationId: tenant.organizationId,
          content: payload.content,
      });

    return ok(
      {
        message: `Invite sent to ${payload.inviteEmail}`,
        data,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[POST_SEND_INVITE_EXCEPTION]:", err);
    return fail(err);
  }
}
