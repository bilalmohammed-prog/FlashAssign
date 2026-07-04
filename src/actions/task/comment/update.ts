"use server";

import { z } from "zod";
import { requireOrgContext } from "@/actions/_helpers/requireOrgContext";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { uuidSchema } from "@/lib/validation/common";
import type { Tables } from "@/lib/types/database";
import { createAuditLog } from "@/services/audit/audit.service";
import {
  listCommentsForTask,
  updateCommentForTask,
} from "@/services/task/comment.service";

const commentContentSchema = z.string().trim().min(1).max(4000);

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

export async function updateTaskComment(
  taskId: string,
  commentId: string,
  orgId: string,
  content: string
): Promise<Tables<"comments">> {
  const validatedTaskId = uuidSchema.parse(taskId);
  const validatedCommentId = uuidSchema.parse(commentId);
  const validatedOrgId = uuidSchema.parse(orgId);
  const validatedContent = commentContentSchema.parse(content);

  const ctx = await requireOrgContext({ organizationId: validatedOrgId });
  const before = (await listCommentsForTask(ctx.supabase, {
    organizationId: ctx.organizationId,
    taskId: validatedTaskId,
  })).find((comment) => comment.id === validatedCommentId);

  const comment = await updateCommentForTask(ctx.supabase, {
    organizationId: ctx.organizationId,
    taskId: validatedTaskId,
    commentId: validatedCommentId,
    content: validatedContent,
    actorId: ctx.userId,
    actorRole: ctx.role,
  });

  void getTaskProjectId(ctx.organizationId, validatedTaskId)
    .then((projectId) =>
      createAuditLog(supabaseAdmin, {
        organizationId: ctx.organizationId,
        projectId,
        actorId: ctx.userId,
        action: "UPDATE",
        entityType: "task",
        entityId: validatedTaskId,
        changes: [
          {
            field: `comment:${comment.id}`,
            before: before?.content ?? null,
            after: comment.content,
          },
        ],
      })
    )
    .catch((error: unknown) => {
      console.error("[task_comment_audit_failed]", error);
    });

  return comment;
}
