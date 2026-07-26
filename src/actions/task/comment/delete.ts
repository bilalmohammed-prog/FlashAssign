"use server";

import { requireOrgContext } from "@/actions/_helpers/requireOrgContext";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { uuidSchema } from "@/lib/validation/common";
import { createAuditLog } from "@/services/audit/audit.service";
import {
  deleteCommentForTask,
  listCommentsForTask,
} from "@/services/task/comment.service";

async function getTaskProjectId(
  organizationId: string,
  taskId: string
): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("tasks")
    .select("project_id")
    .eq("organization_id", organizationId)
    .eq("id", taskId)
    .maybeSingle();

  return data?.project_id ?? null;
}

export async function deleteTaskComment(
  taskId: string,
  commentId: string,
  orgId: string
): Promise<boolean> {
  const validatedTaskId = uuidSchema.parse(taskId);
  const validatedCommentId = uuidSchema.parse(commentId);
  const validatedOrgId = uuidSchema.parse(orgId);

  const ctx = await requireOrgContext({ organizationId: validatedOrgId });
  const before = (await listCommentsForTask(ctx.supabase, {
    organizationId: ctx.organizationId,
    taskId: validatedTaskId,
  })).find((comment) => comment.id === validatedCommentId);

  await deleteCommentForTask(ctx.supabase, {
    organizationId: ctx.organizationId,
    taskId: validatedTaskId,
    commentId: validatedCommentId,
    actorId: ctx.userId,
    actorRole: ctx.role,
  });

  void getTaskProjectId(ctx.organizationId, validatedTaskId)
    .then((projectId) =>
      createAuditLog(supabaseAdmin, {
        organizationId: ctx.organizationId,
        projectId,
        actorId: ctx.userId,
        action: "DELETE",
        entityType: "task",
        entityId: validatedTaskId,
        changes: [
          {
            field: "comment",
            before: before?.content ?? null,
            after: null,
          },
        ],
      })
    )
    .catch((error: unknown) => {
      console.error("[task_comment_audit_failed]", error);
    });

  return true;
}
