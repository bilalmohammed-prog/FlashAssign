import type { SupabaseClient } from "@supabase/supabase-js";
import { ValidationError } from "@/lib/api/errors";
import type { Database } from "@/lib/types/database";

export type MyTaskListItem = {
  id: string;
  title: string;
  description: string | null;
  status: Database["public"]["Enums"]["task_status"];
  due_date: string | null;
  project_id: string | null;
  project_name: string | null;
  allocated_hours: number | null;
};

type AssignmentWithTaskRow = {
  task_id: string;
  allocated_hours: number | null;
  tasks: {
    id: string;
    title: string;
    description: string | null;
    status: Database["public"]["Enums"]["task_status"] | null;
    due_date: string | null;
    deleted_at: string | null;
    organization_id: string;
    project_id: string | null;
    projects: {
      id: string;
      name: string;
    } | null;
  } | null;
};

export async function listMyTasks(
  supabase: SupabaseClient<Database>,
  params: { organizationId: string; userId: string }
): Promise<MyTaskListItem[]> {
  const queryStart = Date.now();
  const { data, error } = await supabase
    .from("assignments")
    .select(
      "task_id,allocated_hours,tasks!inner(id,title,description,status,due_date,deleted_at,organization_id,project_id,projects(id,name))"
    )
    .eq("user_id", params.userId)
    .eq("tasks.organization_id", params.organizationId)
    .is("tasks.deleted_at", null)
    .order("due_date", {
      ascending: true,
      nullsFirst: false,
      foreignTable: "tasks",
    });

  if (error) {
    throw new ValidationError({ message: error.message, details: error });
  }

  console.info(`[perf] service listMyTasks query ${Date.now() - queryStart}ms`);

  const rows = (data ?? []) as AssignmentWithTaskRow[];

  const computeStart = Date.now();
  const result = rows
    .map((row) => {
      const task = row.tasks;
      if (!task) {
        return null;
      }

      return {
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status ?? "todo",
        due_date: task.due_date,
        project_id: task.project_id ?? null,
        project_name: task.projects?.name ?? null,
        allocated_hours: row.allocated_hours ?? null,
      };
    })
    .filter((row): row is MyTaskListItem => row !== null);

  const computeMs = Date.now() - computeStart;
  if (computeMs > 12) {
    console.info(`[perf] service listMyTasks map ${computeMs}ms`);
  }

  return result;
}
