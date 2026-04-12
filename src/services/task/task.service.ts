import type { SupabaseClient } from "@supabase/supabase-js";
import { NotFoundError, ValidationError } from "@/lib/api/errors";
import type { Database, Tables, TablesInsert } from "@/lib/types/database";

export async function createTask(
  supabase: SupabaseClient<Database>,
  params: {
    projectId: string | null;
    organizationId: string;
    createdBy: string;
    title: string;
    description?: string;
    dueDate?: string;
  }
): Promise<Tables<"tasks">> {
  if (params.projectId) {
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id")
      .eq("id", params.projectId)
      .eq("organization_id", params.organizationId)
      .is("deleted_at", null)
      .maybeSingle();

    if (projectError) {
      throw new ValidationError({ message: projectError.message, details: projectError });
    }

    if (!project) {
      throw new NotFoundError({ message: "Project not found in this organization" });
    }
  }

  const insert: TablesInsert<"tasks"> = {
    project_id: params.projectId,
    organization_id: params.organizationId,
    created_by: params.createdBy,
    title: params.title,
    description: params.description ?? null,
    status: "todo",
    due_date: params.dueDate ?? null,
  };

  const { data, error } = await supabase.from("tasks").insert(insert).select("*").maybeSingle();

  if (error) {
    throw new ValidationError({ message: error.message, details: error });
  }

  if (!data) {
    throw new ValidationError({ message: "Failed to create task" });
  }

  return data;
}

export async function getTasksByProject(
  supabase: SupabaseClient<Database>,
  params: { organizationId: string; projectId: string }
): Promise<Tables<"tasks">[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("organization_id", params.organizationId)
    .eq("project_id", params.projectId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    throw new ValidationError({ message: error.message, details: error });
  }

  return data ?? [];
}

export async function getTaskById(
  supabase: SupabaseClient<Database>,
  params: { organizationId: string; taskId: string }
): Promise<Tables<"tasks"> | null> {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("organization_id", params.organizationId)
    .eq("id", params.taskId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw new ValidationError({ message: error.message, details: error });
  }

  return data ?? null;
}

export async function updateTaskStatus(
  supabase: SupabaseClient<Database>,
  params: {
    organizationId: string;
    taskId: string;
    status: "todo" | "in_progress" | "blocked" | "done";
  }
): Promise<Tables<"tasks">> {
  const { data, error } = await supabase
    .from("tasks")
    .update({ status: params.status })
    .eq("organization_id", params.organizationId)
    .eq("id", params.taskId)
    .is("deleted_at", null)
    .select("*")
    .maybeSingle();

  if (error) {
    throw new ValidationError({ message: error.message, details: error });
  }

  if (!data) {
    throw new NotFoundError({ message: "Task not found in your organization" });
  }

  return data;
}

export async function deleteTask(
  supabase: SupabaseClient<Database>,
  params: { organizationId: string; taskId: string }
): Promise<void> {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("tasks")
    .update({ deleted_at: now })
    .eq("organization_id", params.organizationId)
    .eq("id", params.taskId)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new ValidationError({ message: error.message, details: error });
  }

  if (!data) {
    throw new NotFoundError({ message: "Task not found in your organization" });
  }
}
export async function updateTask(
  supabase: SupabaseClient<Database>,
  params: {
    organizationId: string;
    taskId: string;
    updates: {
      title?: string;
      description?: string | null;
      due_date?: string | null;
      status?: "todo" | "in_progress" | "blocked" | "done";
      project_id?: string | null;
    };
  }
): Promise<Tables<"tasks">> {
  const { data, error } = await supabase
    .from("tasks")
    .update(params.updates)
    .eq("organization_id", params.organizationId)
    .eq("id", params.taskId)
    .is("deleted_at", null)
    .select("*")
    .maybeSingle();

  if (error) {
    throw new ValidationError({ message: error.message, details: error });
  }

  if (!data) {
    throw new NotFoundError({ message: "Task not found in your organization" });
  }

  return data;
}
