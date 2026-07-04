"use server";

import { requireOrgContext } from "@/actions/_helpers/requireOrgContext";
import { authorize } from "@/lib/auth/authorization";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createAuditLog } from "@/services/audit/audit.service";
import { createAssignment } from "@/services/resource/assignment.service";
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
  project_id: string | null,
  assigneeId?: string | null,
): Promise<Tables<"tasks">> {
  const normalizedStartDate = startDate || null;
  const normalizedDueDate = dueDate || null;

  const validatedStartDate =
    isoDateStringSchema.nullable().optional().parse(normalizedStartDate);

  const validatedDueDate =
    isoDateStringSchema.nullable().optional().parse(normalizedDueDate);
  const validatedTitle = nonEmptyStringSchema.parse(title);
  const validatedDescription = optionalTextSchema.optional().parse(description);
  const validatedOrgId = uuidSchema.parse(orgId);
  const validatedProjectId = project_id != null ? uuidSchema.parse(project_id) : null;
  const validatedAssigneeId = assigneeId ? uuidSchema.parse(assigneeId) : null;

  const ctx = await requireOrgContext({ organizationId: validatedOrgId });
  authorize("create", "task", { role: ctx.role });
  if (validatedAssigneeId) {
    authorize("assign", "task", { role: ctx.role });
  }

  const result = await createTaskService(ctx.supabase, {
    organizationId: ctx.organizationId,
    projectId: validatedProjectId,
    startDate: validatedStartDate ?? undefined,
    createdBy: ctx.user.id,
    title: validatedTitle,
    description: validatedDescription,
    dueDate: validatedDueDate ?? undefined,
  });

  let assigneeName: string | null = null;
  if (validatedAssigneeId) {
    await createAssignment(ctx.supabase, {
      organizationId: ctx.organizationId,
      taskId: result.id,
      userId: validatedAssigneeId,
    });

    const { data: profile } = await ctx.supabase
      .from("profiles")
      .select("full_name")
      .eq("id", validatedAssigneeId)
      .maybeSingle();

    assigneeName = profile?.full_name ?? null;
  }

  let projectName = "No Project";
  if (result.project_id) {
    const { data: project } = await ctx.supabase
      .from("projects")
      .select("name")
      .eq("id", result.project_id)
      .eq("organization_id", ctx.organizationId)
      .is("deleted_at", null)
      .maybeSingle();

    projectName = project?.name ?? projectName;
  }

  await createAuditLog(supabaseAdmin, {
    organizationId: ctx.organizationId,
    projectId: result.project_id,
    actorId: ctx.user.id,
    action: "CREATE",
    entityType: "task",
    entityId: result.id,
    changes: [
      {
        field: "title",
        before: null,
        after: result.title,
      },
      {
        field: "description",
        before: null,
        after: result.description,
      },
      {
        field: "status",
        before: null,
        after: result.status,
      },
      {
        field: "project",
        before: null,
        after: projectName,
      },
      {
        field: "start_date",
        before: null,
        after: result.start_date,
      },
      {
        field: "due_date",
        before: null,
        after: result.due_date,
      },
      ...(validatedAssigneeId
        ? [
            {
              field: "assignee",
              before: null,
              after: assigneeName,
            },
          ]
        : []),
    ],
  });

  revalidateTag(`analytics-${ctx.organizationId}`, "default");

  return result;
}
