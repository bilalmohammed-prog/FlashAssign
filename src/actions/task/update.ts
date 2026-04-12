"use server";

import { requireOrgContext } from "@/actions/_helpers/requireOrgContext";
import { authorize } from "@/lib/auth/authorization";
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
    dueDate: updates.due_date,
    status: updates.status,
    project_id: updates.project_id,
  });

  const ctx = await requireOrgContext({ organizationId: validatedOrgId });
  authorize("update", "task", { role: ctx.role });

  return updateTaskService(ctx.supabase, {
    organizationId: ctx.organizationId,
    taskId: validatedTaskId,
    updates: {
      title: validatedUpdates.title,
      description: validatedUpdates.description,
      due_date: validatedUpdates.dueDate,
      status: normalizeTaskUpdateStatus(validatedUpdates.status),
      project_id: validatedUpdates.project_id,
    },
  });
}
