"use server";

import { requireOrgContext } from "@/actions/_helpers/requireOrgContext";
import { authorize } from "@/lib/auth/authorization";
import { addProjectMember } from "@/services/resource/projectMember.service";
import { uuidSchema } from "@/lib/validation/common";

export async function assignProjectMember(
  projectId: string,
  userId: string,
  orgId: string
) {
  const validatedProjectId = uuidSchema.parse(projectId);
  const validatedUserId = uuidSchema.parse(userId);
  const validatedOrgId = uuidSchema.parse(orgId);

  const ctx = await requireOrgContext({ organizationId: validatedOrgId });
  authorize("update", "project", { role: ctx.role });
  await addProjectMember(ctx.supabase, {
    organizationId: ctx.organizationId,
    projectId: validatedProjectId,
    userId: validatedUserId,
  });
}
