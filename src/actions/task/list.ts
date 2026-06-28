"use server";

import { requireOrgContext } from "@/actions/_helpers/requireOrgContext";
import { listAssignments } from "@/services/resource/assignment.service";
import { uuidSchema } from "@/lib/validation/common";

export async function listTasks(employeeId: string) {
  const actionStart = Date.now();
  const validatedEmployeeId = uuidSchema.parse(employeeId);

  const contextStart = Date.now();
  const ctx = await requireOrgContext();
  console.info(`[perf] action listTasks context ${Date.now() - contextStart}ms`);

  const queryStart = Date.now();
  const rows = await listAssignments(ctx.supabase, {
    organizationId: ctx.organizationId,
    userId: validatedEmployeeId,
  });
  console.info(`[perf] action listTasks assignments ${Date.now() - queryStart}ms`);

  const mapStart = Date.now();
  const result = rows
    .filter((row) => row.task)
    .map((row) => ({
      allocated_hours: row.allocated_hours,
      start_time: row.start_time,
      end_time: row.end_time,
      tasks: row.task
        ? {
            id: row.task.id,
            title: row.task.title,
            status: row.task.status,
            
            due_date: null,
            deleted_at: null,
          }
        : null,
    }));
  const mapMs = Date.now() - mapStart;
  if (mapMs > 8) {
    console.info(`[perf] action listTasks map ${mapMs}ms`);
  }
  console.info(`[perf] action listTasks total ${Date.now() - actionStart}ms`);

  return result;
}