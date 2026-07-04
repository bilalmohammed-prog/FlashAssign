"use server";

import { z } from "zod";
import { requireOrgContext } from "@/actions/_helpers/requireOrgContext";
import { authorize } from "@/lib/auth/authorization";
import { uuidSchema } from "@/lib/validation/common";
import type { Database } from "@/lib/types/database";
import { addMember as addMemberService } from "@/services/organization/member.service";
import { safeErrorMessage, type ActionResult } from "./_shared";

type RoleType = Database["public"]["Enums"]["role_type"];

const roleSchema = z.enum(["owner", "admin", "manager", "employee", "viewer"]);

const addMemberInputSchema = z.object({
  organizationId: uuidSchema,
  userId: uuidSchema,
  role: roleSchema,
});

export type AddMemberInput = {
  organizationId: string;
  userId: string;
  role: RoleType;
};

export type AddMemberActionData = {
  member: Database["public"]["Tables"]["org_members"]["Row"];
  created: boolean;
};

export async function addMember(
  input: AddMemberInput
): Promise<ActionResult<AddMemberActionData>> {
  try {
    const validated = addMemberInputSchema.parse(input);

    const ctx = await requireOrgContext({ organizationId: validated.organizationId });
    authorize("manage_members", "organization", { role: ctx.role });

    const result = await addMemberService(ctx.supabase, {
      organizationId: ctx.organizationId,
      userId: validated.userId,
      role: validated.role,
      actorId: ctx.userId,
    });

    return {
      data: {
        member: result.member,
        created: result.created,
      },
      error: null,
    };
  } catch (err) {
    return { data: null, error: { message: safeErrorMessage(err) } };
  }
}
