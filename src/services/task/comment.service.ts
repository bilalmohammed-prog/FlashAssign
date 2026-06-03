import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/lib/api/errors";
import type { AppRole } from "@/lib/auth/permissions";
import type { Database, Tables, TablesInsert } from "@/lib/types/database";

type TaskTenantRow = Pick<
  Tables<"tasks">,
  "id" | "organization_id" | "project_id" | "deleted_at"
>;

type CommentRow = Tables<"comments">;

export type CommentWithAuthor = CommentRow & {
  author: {
    id: string;
    full_name: string | null;
  } | null;
};

function canManageComment(role: AppRole, _actorId: string, _comment: CommentRow): boolean {
  return role === "owner" || role === "admin";
}

async function assertTaskInOrganization(
  supabase: SupabaseClient<Database>,
  params: { organizationId: string; taskId: string }
): Promise<TaskTenantRow> {
  const { data, error } = await supabase
    .from("tasks")
    .select("id,organization_id,project_id,deleted_at")
    .eq("id", params.taskId)
    .eq("organization_id", params.organizationId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw new ValidationError({ message: error.message, details: error });
  }

  if (!data) {
    throw new NotFoundError({
      message: "Task not found in your organization",
    });
  }

  return data;
}

async function getCommentForTask(
  supabase: SupabaseClient<Database>,
  params: { organizationId: string; taskId: string; commentId: string }
): Promise<CommentRow> {
  const { data, error } = await supabase
    .from("comments")
    .select("*")
    .eq("id", params.commentId)
    .eq("task_id", params.taskId)
    .eq("organization_id", params.organizationId)
    .maybeSingle();

  if (error) {
    throw new ValidationError({ message: error.message, details: error });
  }

  if (!data) {
    throw new NotFoundError({ message: "Comment not found" });
  }

  return data;
}

export async function listCommentsForTask(
  supabase: SupabaseClient<Database>,
  params: { organizationId: string; taskId: string }
): Promise<CommentWithAuthor[]> {
  await assertTaskInOrganization(supabase, params);

  const { data, error } = await supabase
    .from("comments")
    .select("id,task_id,user_id,content,created_at,organization_id,project_id")
    .eq("organization_id", params.organizationId)
    .eq("task_id", params.taskId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new ValidationError({ message: error.message, details: error });
  }

  const rows = data ?? [];
  const userIds = Array.from(
    new Set(
      rows
        .map((row) => row.user_id)
        .filter((userId): userId is string => typeof userId === "string")
    )
  );

  const { data: profiles, error: profilesError } =
    userIds.length > 0
      ? await supabase.from("profiles").select("id,full_name").in("id", userIds)
      : { data: [], error: null };

  if (profilesError) {
    throw new ValidationError({
      message: profilesError.message,
      details: profilesError,
    });
  }

  const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

  return rows.map((row) => {
    const profile = row.user_id ? profileById.get(row.user_id) : undefined;
    return {
      id: row.id,
      task_id: row.task_id,
      user_id: row.user_id,
      content: row.content,
      created_at: row.created_at,
      organization_id: row.organization_id,
      project_id: row.project_id,
      author: profile
        ? {
            id: profile.id,
            full_name: profile.full_name ?? null,
          }
        : null,
    };
  });
}

export async function createCommentForTask(
  supabase: SupabaseClient<Database>,
  params: { organizationId: string; userId: string; taskId: string; content: string }
): Promise<CommentRow> {
  const task = await assertTaskInOrganization(supabase, {
    organizationId: params.organizationId,
    taskId: params.taskId,
  });

  const insertPayload: TablesInsert<"comments"> = {
    organization_id: params.organizationId,
    task_id: params.taskId,
    user_id: params.userId,
    content: params.content,
    project_id: task.project_id ?? null,
  };

  const { data, error } = await supabase
    .from("comments")
    .insert(insertPayload)
    .select("*")
    .maybeSingle();

  if (error) {
    throw new ValidationError({ message: error.message, details: error });
  }

  if (!data) {
    throw new ValidationError({ message: "Unable to create comment" });
  }

  return data;
}

export async function updateCommentForTask(
  supabase: SupabaseClient<Database>,
  params: {
    organizationId: string;
    taskId: string;
    commentId: string;
    content: string;
    actorId: string;
    actorRole: AppRole;
  }
): Promise<CommentRow> {
  await assertTaskInOrganization(supabase, {
    organizationId: params.organizationId,
    taskId: params.taskId,
  });

  const comment = await getCommentForTask(supabase, {
    organizationId: params.organizationId,
    taskId: params.taskId,
    commentId: params.commentId,
  });

  if (!canManageComment(params.actorRole, params.actorId, comment)) {
    throw new ForbiddenError({
      message: "Only owner/admin or the comment author can edit this comment",
    });
  }

  const { data, error } = await supabase
    .from("comments")
    .update({ content: params.content })
    .eq("id", params.commentId)
    .eq("task_id", params.taskId)
    .eq("organization_id", params.organizationId)
    .select("*")
    .maybeSingle();

  if (error) {
    throw new ValidationError({ message: error.message, details: error });
  }

  if (!data) {
    throw new NotFoundError({ message: "Comment not found" });
  }

  return data;
}

export async function deleteCommentForTask(
  supabase: SupabaseClient<Database>,
  params: {
    organizationId: string;
    taskId: string;
    commentId: string;
    actorId: string;
    actorRole: AppRole;
  }
): Promise<void> {
  await assertTaskInOrganization(supabase, {
    organizationId: params.organizationId,
    taskId: params.taskId,
  });

  const comment = await getCommentForTask(supabase, {
    organizationId: params.organizationId,
    taskId: params.taskId,
    commentId: params.commentId,
  });

  if (!canManageComment(params.actorRole, params.actorId, comment)) {
    throw new ForbiddenError({
      message: "Only owner/admin or the comment author can delete this comment",
    });
  }

  const { data, error } = await supabase
    .from("comments")
    .delete()
    .eq("id", params.commentId)
    .eq("task_id", params.taskId)
    .eq("organization_id", params.organizationId)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new ValidationError({ message: error.message, details: error });
  }

  if (!data) {
    throw new NotFoundError({ message: "Comment not found" });
  }
}
