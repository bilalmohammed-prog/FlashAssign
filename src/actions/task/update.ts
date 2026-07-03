"use server";

import { requireOrgContext } from "@/actions/_helpers/requireOrgContext";
import { authorizeTaskUpdate } from "@/lib/auth/task-authorization";
import { listAssignments } from "@/services/resource/assignment.service";
import { updateTask as updateTaskService } from "@/services/task/task.service";
import { uuidSchema } from "@/lib/validation/common";
import { taskUpdateSchema, normalizeTaskUpdateStatus } from "@/lib/validation/task";
import type { Tables, TablesUpdate } from "@/lib/types/database";
import { createAuditLog } from "@/services/audit/audit.service";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getTaskById } from "@/services/task/task.service";

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
  
  const before = await getTaskById(ctx.supabase, {
    organizationId: ctx.organizationId,
    taskId: validatedTaskId,
  });
  let beforeProjectName: string | null = null;
  if (!before) {
    throw new Error("Task not found");
  }
  if (before.project_id) {
    const { data } = await ctx.supabase
      .from("projects")
      .select("name")
      .eq("id", before.project_id)
      .maybeSingle();

    beforeProjectName = data?.name ?? null;
  }

  
  const updatedTask = await updateTaskService(ctx.supabase, {
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

let afterProjectName: string | null = null;

  if (updatedTask.project_id) {
    const { data } = await ctx.supabase
      .from("projects")
      .select("name")
      .eq("id", updatedTask.project_id)
      .maybeSingle();

    afterProjectName = data?.name ?? null;
  }
  const changes = [];

if (before.project_id !== updatedTask.project_id) {
  changes.push({
    field: "project",
    before: beforeProjectName,
    after: afterProjectName,
  });
}
if (before.title !== updatedTask.title) {
  changes.push({
    field: "title",
    before: before.title,
    after: updatedTask.title,
  });
}
if (before.description !== updatedTask.description) {
  changes.push({
    field: "description",
    before: before.description,
    after: updatedTask.description,
  });
}

if (before.start_date !== updatedTask.start_date) {
  changes.push({
    field: "start_date",
    before: before.start_date,
    after: updatedTask.start_date,
  });
}

if (before.due_date !== updatedTask.due_date) {
  changes.push({
    field: "due_date",
    before: before.due_date,
    after: updatedTask.due_date,
  });
}

if (before.status !== updatedTask.status) {
  changes.push({
    field: "status",
    before: before.status,
    after: updatedTask.status,
  });
}

if (before.project_id !== updatedTask.project_id) {
  changes.push({
    field: "project_id",
    before: before.project_id,
    after: updatedTask.project_id,
  });
}
console.log("Changes:", changes);
  await createAuditLog(supabaseAdmin, {
    organizationId: ctx.organizationId,
    projectId: updatedTask.project_id,
    actorId: ctx.userId,
    action: "UPDATE",
    entityType: "task",
    entityId: updatedTask.id,
    changes,
  });
  return updatedTask;
}
