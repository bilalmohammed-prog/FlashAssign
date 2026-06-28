"use server";

import { requireOrgContext } from "@/actions/_helpers/requireOrgContext";
import { authorizeTaskUpdate } from "@/lib/auth/task-authorization";
import { listAssignments } from "@/services/resource/assignment.service";
import { updateTask as updateTaskService } from "@/services/task/task.service";
import { uuidSchema } from "@/lib/validation/common";
import { taskUpdateSchema, normalizeTaskUpdateStatus } from "@/lib/validation/task";
import type { Tables, TablesUpdate } from "@/lib/types/database";

export async function updateTask(
  taskId: string,
  updates: TablesUpdate<"tasks">,
  orgId: string
): Promise<Tables<"tasks">> {
  const validatedTaskId = uuidSchema.parse(taskId);
  const validatedOrgId = uuidSchema.parse(orgId);
  const validatedUpdates = taskUpdateSchema.parse({
    title: updates.title,
    description: updates.description,
    startDate: updates.start_date,
    dueDate: updates.due_date,
    status: updates.status,
    project_id: updates.project_id,
  });

  const ctx = await requireOrgContext({ organizationId: validatedOrgId });

  const assignments = await listAssignments(ctx.supabase, {
    organizationId: ctx.organizationId,
    taskId: validatedTaskId,
  });
  const assigneeUserId = assignments[0]?.user_id ?? null;

  authorizeTaskUpdate(ctx.role, {
    userId: ctx.userId,
    assigneeUserId,
    updates: {
      title: validatedUpdates.title,
      description: validatedUpdates.description,
      start_date: validatedUpdates.startDate,
      due_date: validatedUpdates.dueDate,
      status: normalizeTaskUpdateStatus(validatedUpdates.status),
      project_id: validatedUpdates.project_id,
    },
  });

  return updateTaskService(ctx.supabase, {
    organizationId: ctx.organizationId,
    taskId: validatedTaskId,
    updates: {
      title: validatedUpdates.title,
      description: validatedUpdates.description,
      start_date: validatedUpdates.startDate,
      due_date: validatedUpdates.dueDate,
      status: normalizeTaskUpdateStatus(validatedUpdates.status),
      project_id: validatedUpdates.project_id,
    },
  });
}
