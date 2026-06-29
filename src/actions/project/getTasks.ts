"use server";

import { getSupabaseServer } from "@/lib/supabase/server"; // Update path to your server-side client config
import { Database } from "@/lib/types/database";
import { getTasksByProject } from "@/services/task/task.service"; // Assuming this is where your RPC helper lives

export type TaskWithMeta =
  Database["public"]["Functions"]["list_project_tasks_with_meta"]["Returns"][number];

export type GetTasksResponse = {
  tasks: TaskWithMeta[];
  totalCount: number;
};

type GetTasksParams = {
  organizationId: string;
  projectId: string;
  pageSize: number;
  pageOffset: number;
  search?: string;
  status?: "todo" | "in_progress" | "blocked" | "done" | "all";
  startDate?: string;
  dueDate?: string;
  sortBy?: "title" | "start_date" | "due_date" | "created_at";
  sortOrder?: "asc" | "desc";
};

export async function getProjectTasksAction(params: GetTasksParams): Promise<GetTasksResponse> {
  const supabase = await getSupabaseServer();

  // Convert client-facing filters to the formats expected by your DB RPC wrapper
  const dbData = await getTasksByProject(supabase, {
    organizationId: params.organizationId,
    projectId: params.projectId,
    searchQuery: params.search || null,
    statusFilter: params.status === "all" ? null : params.status || null,
    startDateFrom: params.startDate || null,
    dueDateTo: params.dueDate || null,
    sortBy: params.sortBy || "created_at",
    sortOrder: params.sortOrder || "desc",
    pageSize: params.pageSize,
    pageOffset: params.pageOffset,
  });

  // Safe estimation or matching mapping depending on your custom RPC return signature
  // Assuming RPC returns either array of tasks or wrapped structure. Adjust accordingly.
  const totalCount = dbData.length > 0 ? (dbData[0].total_count ?? dbData.length) : 0; 

  return {
    tasks: dbData,
    totalCount: Number(totalCount),
  };
}