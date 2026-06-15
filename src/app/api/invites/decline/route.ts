import { NextResponse } from "next/server";
import { z } from "zod";
import { fail } from "@/lib/api/response";
import { requireActionUser } from "@/actions/_helpers/requireOrgContext";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { uuidSchema } from "@/lib/validation/common";

const declineInviteBodySchema = z.object({
  token: z.string().min(1),
}).strict();

export async function POST(req: Request) {
  try {


    

    const { token } = declineInviteBodySchema.parse(await req.json());

    const { data: invite, error } = await supabaseAdmin
      .from("invites")
      .select("id, status")
      .eq("token", token)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!invite) {
      return NextResponse.json({ error: "Invite not found." }, { status: 404 });
    }

    

    if (invite.status !== "pending") {
      return NextResponse.json(
        { error: `Invite is already ${invite.status}.` },
        { status: 400 }
      );
    }

    const { error: updateError } = await supabaseAdmin
      .from("invites")
      .update({
        status: "declined",
        declined_at: new Date().toISOString(),
      })
      .eq("id", invite.id);

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Invitation declined.",
    });
  } catch (err) {
    console.error("Decline Invite Error:", err);
    return fail(err);
  }
}