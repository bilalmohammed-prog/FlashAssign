"use server";

import { z } from "zod";
import { requireOrgContext } from "@/actions/_helpers/requireOrgContext";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { uuidSchema } from "@/lib/validation/common";
import type { Tables } from "@/lib/types/database";
import { createAuditLog } from "@/services/audit/audit.service";
import { createCommentForTask } from "@/services/task/comment.service";

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

export async function createTaskComment(
  taskId: string,
  orgId: string,
  content: string
): Promise<Tables<"comments">> {
  const validatedTaskId = uuidSchema.parse(taskId);
  const validatedOrgId = uuidSchema.parse(orgId);
  const validatedContent = commentContentSchema.parse(content);

  const ctx = await requireOrgContext({ organizationId: validatedOrgId });

  const comment = await createCommentForTask(ctx.supabase, {
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    taskId: validatedTaskId,
    content: validatedContent,
  });

  void getTaskProjectId(ctx.organizationId, validatedTaskId)
    .then((projectId) =>
      createAuditLog(supabaseAdmin, {
        organizationId: ctx.organizationId,
        projectId,
        actorId: ctx.userId,
        action: "CREATE",
        entityType: "task",
        entityId: validatedTaskId,
        changes: [
          { field: "comment_id", before: null, after: comment.id },
          { field: "comment", before: null, after: comment.content },
        ],
      })
    )
    .catch((error: unknown) => {
      console.error("[task_comment_audit_failed]", error);
    });

  return comment;
}
