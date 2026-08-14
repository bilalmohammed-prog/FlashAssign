import type { Database, Enums } from "./database";

export type TaskStatus = Enums<"task_status">;

export type EmployeeTaskRpc = {
  id: string;
  organization_id: string;
  project_id: string | null;
  project_name: string | null;
  title: string;
  description: string | null;
  status: string;
  start_date: string | null;
  due_date: string | null;
  created_by: string;
  created_at: string;
  total_count: number;
};