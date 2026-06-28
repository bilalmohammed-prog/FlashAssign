import { apiFetch } from './client';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/database';
import {
  DisplayTasksResponse,
  DisplayTasksResponseSchema,
  EmployeeOverviewResponse,
  EmployeeOverviewResponseSchema,
  EmployeeSwitchResponse,
  EmployeeSwitchResponseSchema,
  AcceptInviteRequest,
  AcceptInviteRequestSchema,
  InviteActionResponse,
  InviteActionResponseSchema,
  DropInviteRequest,
  DropInviteRequestSchema,
  DropInviteResponse,
  DropInviteResponseSchema,
  MessagesResponse,
  MessagesResponseSchema,
  SendMessageRequest,
  SendMessageRequestSchema,
  SendMessageResponse,
  SendMessageResponseSchema,
  CreateTaskRequest,
  CreateTaskRequestSchema,
  CreateTaskResponse,
  CreateTaskResponseSchema,
  UpdateTaskRequest,
  UpdateTaskRequestSchema,
  UpdateTaskResponse,
  UpdateTaskResponseSchema,
  DeleteTaskResponse,
  DeleteTaskResponseSchema,
  TeamProgressResponse,
  TeamProgressResponseSchema,
} from './types';

type RawTask = {
  id?: string;
  user_id?: string;
  employee_id?: string;
  title?: string;
  task?: string;
  description?: string | null;
  status?: string;
  start_date?: string | null;
  startDate?: string | null;
  due_date?: string | null;
  dueDate?: string | null;
  endTime?: string | null;
  startTime?: string | null;
};

function toCanonicalTask(raw: RawTask | null | undefined) {
  return {
    id: raw?.id ?? '',
    user_id: raw?.user_id ?? raw?.employee_id ?? '',
    title: raw?.title ?? raw?.task ?? '',
    description: raw?.description ?? null,
    status: raw?.status ?? 'todo',
    due_date: raw?.due_date ?? raw?.dueDate ?? raw?.endTime ?? raw?.startTime ?? null,
  };
}

// GET /api/displayTasks
export async function getDisplayTasks(employeeId: string): Promise<DisplayTasksResponse> {
  const response = await apiFetch(`/api/displayTasks?employee_id=${encodeURIComponent(employeeId)}`);
  const responseBody = await response.json();
  const data = responseBody?.success ? responseBody.data : responseBody;
  const normalized = {
    tasks: Array.isArray(data?.tasks)
      ? (data.tasks as RawTask[]).map((t) => toCanonicalTask(t))
      : [],
  };
  return DisplayTasksResponseSchema.parse(normalized);
}

// GET /api/employee-overview
export async function getEmployeeOverview(email: string): Promise<EmployeeOverviewResponse> {
  const response = await apiFetch(`/api/employee-overview?email=${encodeURIComponent(email)}`);
  const responseBody = await response.json();
  const data = responseBody?.success ? responseBody.data : responseBody;
  return EmployeeOverviewResponseSchema.parse(data);
}

// GET /api/employee-switch
export async function getEmployeeSwitch(): Promise<EmployeeSwitchResponse> {
  const response = await apiFetch('/api/employee-switch');
  const responseBody = await response.json();
  const data = responseBody?.success ? responseBody.data : responseBody;
  return EmployeeSwitchResponseSchema.parse(data);
}

// POST /api/invites/accept
export async function acceptInvite(request: AcceptInviteRequest): Promise<InviteActionResponse> {
  AcceptInviteRequestSchema.parse(request);
  const response = await apiFetch('/api/invites/accept', {
    method: 'POST',
    body: JSON.stringify(request),
  });
  const data = await response.json();
  return InviteActionResponseSchema.parse(data);
}

// POST /api/invites/decline
export async function declineInvite(): Promise<InviteActionResponse> {
  const response = await apiFetch('/api/invites/decline', {
    method: 'POST',
  });
  const data = await response.json();
  return InviteActionResponseSchema.parse(data);
}

// DELETE /api/invites/drop
export async function dropInvite(request: DropInviteRequest): Promise<DropInviteResponse> {
  DropInviteRequestSchema.parse(request);
  const response = await apiFetch('/api/invites/drop', {
    method: 'DELETE',
    body: JSON.stringify(request),
  });
  const data = await response.json();
  return DropInviteResponseSchema.parse(data);
}

// GET /api/messages
export async function getMessages(): Promise<MessagesResponse> {
  const response = await apiFetch('/api/messages');
  const data = await response.json();
  return MessagesResponseSchema.parse(data);
}

// POST /api/messages/send
export async function sendMessage(request: SendMessageRequest): Promise<SendMessageResponse> {
  SendMessageRequestSchema.parse(request);
  const response = await apiFetch('/api/messages/send', {
    method: 'POST',
    body: JSON.stringify(request),
  });
  const data = await response.json();
  return SendMessageResponseSchema.parse(data);
}

// POST /api/tasks
export async function createTask(request: CreateTaskRequest): Promise<CreateTaskResponse> {
  const payload = CreateTaskRequestSchema.parse(request);

  const response = await apiFetch('/api/tasks', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  const responseBody = await response.json();
  const data = responseBody?.ok ? responseBody.data : responseBody;
  const normalized = {
    message: data?.message ?? 'Task created',
    task: toCanonicalTask(data?.task),
  };
  return CreateTaskResponseSchema.parse(normalized);
}

// PATCH /api/tasks/[taskId]
export async function updateTask(taskId: string, request: UpdateTaskRequest): Promise<UpdateTaskResponse> {
  const payload = UpdateTaskRequestSchema.parse(request);

  const response = await apiFetch(`/api/tasks/${taskId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  const responseBody = await response.json();
  const data = responseBody?.ok ? responseBody.data : responseBody;
  const normalized = {
    task: toCanonicalTask(data?.task),
  };
  return UpdateTaskResponseSchema.parse(normalized);
}

// DELETE /api/tasks/[taskId]
export async function deleteTask(taskId: string): Promise<DeleteTaskResponse> {
  const response = await apiFetch(`/api/tasks/${taskId}`, {
    method: 'DELETE',
  });
  const responseBody = await response.json();
  const data = responseBody?.ok ? responseBody.data : responseBody;
  return DeleteTaskResponseSchema.parse(data);
}

// GET /api/teamProgress
export async function getTeamProgress(): Promise<TeamProgressResponse> {
  const response = await apiFetch('/api/teamProgress');
  const responseBody = await response.json();
  const data = responseBody?.success ? responseBody.data : responseBody;
  return TeamProgressResponseSchema.parse(data);
}

// ---------- Server-action helpers ----------
export async function getAnalyticsSummaryFromDb(
  supabase: SupabaseClient<Database>,
  organizationId: string
): Promise<{
  totalTasks: number;
  completedTasks: number;
  totalEmployees: number;
  totalResources: number;
}> {
  const [tasks, completed, employees] = await Promise.all([
    supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .is('deleted_at', null),
    supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .is('deleted_at', null)
      .eq('status', 'done'),
    supabase
      .from('org_members')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organizationId),
  ]);

  if (tasks.error) throw new Error(tasks.error.message);
  if (completed.error) throw new Error(completed.error.message);
  if (employees.error) throw new Error(employees.error.message);

  return {
    totalTasks: tasks.count ?? 0,
    completedTasks: completed.count ?? 0,
    totalEmployees: employees.count ?? 0,
    totalResources: 0,
  };
}

export async function listAssignmentsFromDb(
  supabase: SupabaseClient<Database>,
  organizationId: string
): Promise<
  Array<{
    id: string;
    user_id: string;
    task_id: string;
    allocated_hours: number | null;
    user_name: string | null;
    task_title: string | null;
    task_status: string | null;
  }>
> {
  const { data: assignments, error } = await supabase
    .from('assignments')
    .select(
      `
      id,
      user_id,
      task_id,
      allocated_hours,
      tasks:tasks!inner (
        id,
        title,
        status,
        organization_id,
        deleted_at
      )
    `
    )
    .eq('organization_id', organizationId)
    .eq('tasks.organization_id', organizationId)
    .is('tasks.deleted_at', null);

  if (error) throw new Error(error.message);

  type AssignmentRow = {
    id: string;
    user_id: string;
    task_id: string;
    allocated_hours: number | null;
    tasks:
      | { id: string; title: string; status: string | null; organization_id: string; deleted_at: string | null }
      | Array<{ id: string; title: string; status: string | null; organization_id: string; deleted_at: string | null }>
      | null;
  };

  const assignmentRows = (assignments ?? []) as AssignmentRow[];
  const userIds = Array.from(new Set(assignmentRows.map((row) => row.user_id)));
  const profileNameById = new Map<string, string | null>();

  if (userIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id,full_name')
      .in('id', userIds);

    if (profilesError) throw new Error(profilesError.message);

    for (const profile of profiles ?? []) {
      profileNameById.set(profile.id, profile.full_name);
    }
  }

  return assignmentRows.map((row) => {
    const task = Array.isArray(row.tasks) ? row.tasks[0] : row.tasks;
    return {
      id: row.id,
      user_id: row.user_id,
      task_id: row.task_id,
      allocated_hours: row.allocated_hours,
      user_name: profileNameById.get(row.user_id) ?? null,
      task_title: task?.title ?? null,
      task_status: task?.status ?? null,
    };
  });
}

export async function createProjectInDb(
  supabase: SupabaseClient<Database>,
  params: {
    organizationId: string;
    name: string;
    status?: 'active' | 'paused' | 'archived';
    startDate?: string | null;
    endDate?: string | null;
  }
) {
  const { data, error } = await supabase
    .from('projects')
    .insert({
      organization_id: params.organizationId,
      name: params.name,
      status: params.status ?? 'active',
      start_date: params.startDate ?? null,
      end_date: params.endDate ?? null,
    })
    .select()
    .single();

  if (error || !data) throw new Error(error?.message ?? 'Failed to create project');
  return data;
}

export async function listProjectsFromDb(
  supabase: SupabaseClient<Database>,
  organizationId: string
) {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function updateProjectInDb(
  supabase: SupabaseClient<Database>,
  params: {
    organizationId: string;
    projectId: string;
    name?: string;
    status?: 'active' | 'paused' | 'archived';
    startDate?: string | null;
    endDate?: string | null;
  }
) {
  const updates: {
    name?: string;
    status?: 'active' | 'paused' | 'archived';
    start_date?: string | null;
    end_date?: string | null;
  } = {};

  if (params.name !== undefined) updates.name = params.name;
  if (params.status !== undefined) updates.status = params.status;
  if (params.startDate !== undefined) updates.start_date = params.startDate;
  if (params.endDate !== undefined) updates.end_date = params.endDate;

  const { data, error } = await supabase
    .from('projects')
    .update(updates)
    .eq('id', params.projectId)
    .eq('organization_id', params.organizationId)
    .is('deleted_at', null)
    .select()
    .single();

  if (error || !data) throw new Error(error?.message ?? 'Failed to update project');
  return data;
}

export async function softDeleteProjectInDb(
  supabase: SupabaseClient<Database>,
  params: { organizationId: string; projectId: string }
): Promise<void> {
  const now = new Date().toISOString();

  const { error: projectError } = await supabase
    .from('projects')
    .update({ deleted_at: now })
    .eq('id', params.projectId)
    .eq('organization_id', params.organizationId);

  if (projectError) throw new Error(projectError.message);

  const { error: taskError } = await supabase
    .from('tasks')
    .update({ deleted_at: now })
    .eq('project_id', params.projectId)
    .eq('organization_id', params.organizationId);

  if (taskError) throw new Error(taskError.message);
}
