"use server";

import { requireOrgContext } from "@/actions/_helpers/requireOrgContext";
import { uuidSchema } from "@/lib/validation/common";
import {
  listCommentsForTask,
  type CommentWithAuthor,
} from "@/services/task/comment.service";

export async function listTaskComments(
  taskId: string,
  orgId: string
): Promise<CommentWithAuthor[]> {
  const validatedTaskId = uuidSchema.parse(taskId);
  const validatedOrgId = uuidSchema.parse(orgId);

  const ctx = await requireOrgContext({ organizationId: validatedOrgId });

  return listCommentsForTask(ctx.supabase, {
    organizationId: ctx.organizationId,
    taskId: validatedTaskId,
  });
}
