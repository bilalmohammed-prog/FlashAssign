"use server";

import { requireOrgContext } from "@/actions/_helpers/requireOrgContext";
import { authorize } from "@/lib/auth/authorization";
import { createAssignment, deleteAssignment, listAssignments } from "@/services/resource/assignment.service";
import { getTaskById } from "@/services/task/task.service";
import { uuidSchema } from "@/lib/validation/common";
import { createAuditLog } from "@/services/audit/audit.service";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function assignTaskToResource(
  taskId: string,
  userId: string | null
) {
  const validatedTaskId = uuidSchema.parse(taskId);
  const validatedUserId = userId ? uuidSchema.parse(userId) : null;

  const ctx = await requireOrgContext();
  authorize("assign", "task", { role: ctx.role });
  const task = await getTaskById(ctx.supabase, {
    organizationId: ctx.organizationId,
    taskId: validatedTaskId,
  });
  if (!task) throw new Error("Task not found");

  const existingAssignments = await listAssignments(ctx.supabase, {
    organizationId: ctx.organizationId,
    taskId: validatedTaskId,
  });
  const previousAssignee = existingAssignments[0]?.user_id ?? null;
  const previousAssigneeName =
    existingAssignments[0]?.profile?.name ?? null;
    let newAssigneeName: string | null = null;

    if (validatedUserId) {
      const { data: profile } = await ctx.supabase
        .from("profiles")
        .select("full_name")
        .eq("id", validatedUserId)
        .maybeSingle();

      newAssigneeName = profile?.full_name ?? null;
    }
  await Promise.all(
    existingAssignments.map((assignment) =>
      deleteAssignment(ctx.supabase, {
        organizationId: ctx.organizationId,
        assignmentId: assignment.id,
      })
    )
  );

  if (validatedUserId) {
    await createAssignment(ctx.supabase, {
      organizationId: task.organization_id,
      taskId: validatedTaskId,
      userId: validatedUserId,
    });
  }

  if (previousAssignee !== validatedUserId) {
  await createAuditLog(supabaseAdmin, {
    organizationId: ctx.organizationId,
    projectId: task.project_id,
    actorId: ctx.userId,
    action: "UPDATE",
    entityType: "task",
    entityId: task.id,
    changes: [
      {
        field: "assignee",
        before: previousAssigneeName,
        after: newAssigneeName,
      },
    ]
  });
}
}
