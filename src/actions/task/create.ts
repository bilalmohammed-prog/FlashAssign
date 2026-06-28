"use server";

import { requireOrgContext } from "@/actions/_helpers/requireOrgContext";
import { authorize } from "@/lib/auth/authorization";
import { createTask as createTaskService } from "@/services/task/task.service";
import type { Tables } from "@/lib/types/database";
import { revalidateTag } from "next/cache";
import {
  uuidSchema,
  nonEmptyStringSchema,
  optionalTextSchema,
  isoDateStringSchema,
} from "@/lib/validation/common";

export async function createTask(
  title: string,
  description: string | undefined,
  startDate: string | null,
  dueDate: string | null,
  orgId: string,
  project_id: string | null
): Promise<Tables<"tasks">> {
  const validatedTitle = nonEmptyStringSchema.parse(title);
  const validatedDescription = optionalTextSchema.optional().parse(description);
  const validatedStartDate = isoDateStringSchema.nullable().optional().parse(startDate);
  const validatedDueDate = isoDateStringSchema.nullable().optional().parse(dueDate);
  const validatedOrgId = uuidSchema.parse(orgId);
  const validatedProjectId = project_id != null ? uuidSchema.parse(project_id) : null;

  const ctx = await requireOrgContext({ organizationId: validatedOrgId });
  authorize("create", "task", { role: ctx.role });

  const result = await createTaskService(ctx.supabase, {
    organizationId: ctx.organizationId,
    projectId: validatedProjectId,
    startDate: validatedStartDate ?? undefined,
    createdBy: ctx.user.id,
    title: validatedTitle,
    description: validatedDescription,
    dueDate: validatedDueDate ?? undefined,
  });

  // ✅ NOW it runs
  revalidateTag(`analytics-${ctx.organizationId}`, "default");

  return result;
}
