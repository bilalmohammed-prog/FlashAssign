"use server";

import { requireOrgContext } from "@/actions/_helpers/requireOrgContext";
import { authorize } from "@/lib/auth/authorization";
import { deleteTask as deleteTaskService } from "@/services/task/task.service";
import { uuidSchema } from "@/lib/validation/common";
import { revalidateTag } from "next/cache";
import { getTaskById } from "@/services/task/task.service";
import { createAuditLog } from "@/services/audit/audit.service";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { listAssignments } from "@/services/resource/assignment.service";

export async function deleteTask(taskId: string, orgId: string) {
  const validatedTaskId = uuidSchema.parse(taskId);
  const validatedOrgId = uuidSchema.parse(orgId);

  const ctx = await requireOrgContext({ organizationId: validatedOrgId });
  authorize("delete", "task", { role: ctx.role });
  const task = await getTaskById(ctx.supabase, {
    organizationId: ctx.organizationId,
    taskId: validatedTaskId,
  });

  if (!task) {
    throw new Error("Task not found");
  }

  const [projectResult, assignments] = await Promise.all([
    task.project_id
      ? ctx.supabase
          .from("projects")
          .select("name")
          .eq("id", task.project_id)
          .eq("organization_id", ctx.organizationId)
          .is("deleted_at", null)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    listAssignments(ctx.supabase, {
      organizationId: ctx.organizationId,
      taskId: validatedTaskId,
      active: true,
    }),
  ]);

  if (projectResult.error) {
    throw new Error(projectResult.error.message);
  }

  const projectName = projectResult.data?.name ?? "No Project";
  const assigneeName = assignments[0]?.profile?.name ?? null;

  await deleteTaskService(ctx.supabase, {
    organizationId: ctx.organizationId,
    taskId: validatedTaskId,
  });
  await createAuditLog(supabaseAdmin, {
    organizationId: ctx.organizationId,
    projectId: task.project_id,
    actorId: ctx.userId,
    action: "DELETE",
    entityType: "task",
    entityId: task.id,
    changes: [
      {
        field: "title",
        before: task.title,
        after: null,
      },
      {
        field: "description",
        before: task.description,
        after: null,
      },
      {
        field: "status",
        before: task.status,
        after: null,
      },
      {
        field: "project",
        before: projectName,
        after: null,
      },
      {
        field: "start_date",
        before: task.start_date,
        after: null,
      },
      {
        field: "due_date",
        before: task.due_date,
        after: null,
      },
      ...(assigneeName
        ? [
            {
              field: "assignee",
              before: assigneeName,
              after: null,
            },
          ]
        : []),
    ],
  });

  // ✅ invalidate cache AFTER mutation
  revalidateTag(`analytics-${ctx.organizationId}`, "default");

  return true;
}
