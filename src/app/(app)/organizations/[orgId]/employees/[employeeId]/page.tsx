"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Plus } from "lucide-react";
import { createTask } from "@/actions/task/create";
import { updateTask } from "@/actions/task/update";
import { assignTaskToResource } from "@/actions/task/assign";
import { listOrgMembers } from "@/actions/organization/listOrgMembers";
import { supabase } from "@/lib/supabase/client";
import { useOrgRole } from "@/hooks/useOrgRole";
import { Button } from "@/components/ui/button";
import type { Enums } from "@/lib/types/database";

type EmployeeTask = {
  task_id: string;
  title: string;
  status: string | null;
  due_date: string | null;
  project_id: string | null;
  allocated_hours: number | null;
};

type ProjectOption = {
  id: string;
  name: string;
};

type TaskStatus = Enums<"task_status">;

type TaskJoinRow = {
  id: string;
  title: string;
  status: TaskStatus | null;
  due_date: string | null;
  project_id: string | null;
  deleted_at: string | null;
};

type AssignmentTaskRow = {
  task_id: string;
  allocated_hours: number | null;
  tasks: TaskJoinRow | TaskJoinRow[] | null;
};

function mapAssignmentRowsToEmployeeTasks(rows: AssignmentTaskRow[]): EmployeeTask[] {
  return rows.flatMap((row) => {
    const joinedTask = toTaskJoin(row);
    if (!joinedTask) {
      return [];
    }

    return [
      {
        task_id: row.task_id,
        title: joinedTask.title,
        status: joinedTask.status,
        due_date: joinedTask.due_date,
        project_id: joinedTask.project_id,
        allocated_hours: row.allocated_hours,
      },
    ];
  });
}

function toTaskJoin(row: AssignmentTaskRow): TaskJoinRow | null {
  if (!row.tasks) {
    return null;
  }

  return Array.isArray(row.tasks) ? (row.tasks[0] ?? null) : row.tasks;
}

export default function EmployeeTasksPage() {
  const role = useOrgRole();
  const canManage = role === "owner" || role === "admin" || role === "manager";

  const { orgId, employeeId } = useParams<{ orgId: string; employeeId: string }>();
  const [tasks, setTasks] = useState<EmployeeTask[]>([]);
  const [employeeName, setEmployeeName] = useState("Employee");
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");

  const fetchEmployeeTasks = useCallback(async () => {
    const { data } = await supabase
      .from("assignments")
      .select(
        `
          task_id,
          allocated_hours,
          tasks!inner(id, title, status, due_date, project_id, deleted_at)
        `
      )
      .eq("user_id", employeeId)
      .eq("organization_id", orgId)
      .is("tasks.deleted_at", null);

    return mapAssignmentRowsToEmployeeTasks((data ?? []) as AssignmentTaskRow[]);
  }, [employeeId, orgId]);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);

        const members = await listOrgMembers(orgId);
        const match = members.data?.find((m) => m.user_id === employeeId);
        if (match) {
          setEmployeeName(match.name);
        }

        const normalizedTasks = await fetchEmployeeTasks();

        setTasks(normalizedTasks);

        const { data: projectData } = await supabase
          .from("projects")
          .select("id, name")
          .eq("organization_id", orgId)
          .is("deleted_at", null)
          .order("name", { ascending: true });

        setProjects((projectData ?? []).map((p) => ({ id: p.id, name: p.name })));
      } finally {
        setLoading(false);
      }
    }

    if (orgId && employeeId) {
      void load();
    }
  }, [orgId, employeeId, fetchEmployeeTasks]);

  async function handleCreate() {
    if (!title.trim() || !dueDate) {
      return;
    }

    try {
      setCreating(true);
      const created = await createTask(
        title.trim(),
        "",
        dueDate,
        orgId,
        selectedProjectId || null
      );

      await assignTaskToResource(created.id, employeeId);

      setTasks((prev) => [
        {
          task_id: created.id,
          title: created.title,
          status: created.status,
          due_date: created.due_date,
          project_id: created.project_id,
          allocated_hours: null,
        },
        ...prev,
      ]);

      setTitle("");
      setDueDate("");
      setSelectedProjectId("");
      setShowCreate(false);
    } finally {
      setCreating(false);
    }
  }

  async function handleStatusChange(taskId: string, status: TaskStatus) {
    setTasks((prev) =>
      prev.map((task) => (task.task_id === taskId ? { ...task, status } : task))
    );

    try {
      await updateTask(taskId, { status }, orgId);
    } catch {
      setTasks(await fetchEmployeeTasks());
    }
  }

  async function handleDueDateChange(taskId: string, nextDueDate: string) {
    setTasks((prev) =>
      prev.map((task) =>
        task.task_id === taskId
          ? {
              ...task,
              due_date: nextDueDate || null,
            }
          : task
      )
    );

    try {
      await updateTask(taskId, { due_date: nextDueDate || null }, orgId);
    } catch {
      setTasks(await fetchEmployeeTasks());
    }
  }

  async function handleProjectChange(taskId: string, projectId: string | null) {
    setTasks((prev) =>
      prev.map((task) =>
        task.task_id === taskId
          ? {
              ...task,
              project_id: projectId,
            }
          : task
      )
    );

    try {
      await updateTask(taskId, { project_id: projectId }, orgId);
    } catch {
      setTasks(await fetchEmployeeTasks());
    }
  }

  return (
    <div className="flex w-full max-w-5xl flex-col space-y-8 pb-16">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href={`/organizations/${orgId}/team`}
            className="text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900"
          >
            ← Back to Team
          </Link>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-900">Tasks - {employeeName}</h1>
        </div>

        {canManage && (
          <Button
            className="h-10 border-transparent bg-indigo-600 px-5 font-medium text-white shadow-sm hover:bg-indigo-700"
            onClick={() => setShowCreate(true)}
          >
            <Plus className="mr-2 h-4 w-4 opacity-90" />
            Add Task
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {loading && (
          <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
            Loading tasks...
          </div>
        )}

        {!loading && tasks.length === 0 && (
          <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
            No tasks assigned to this employee.
          </div>
        )}

        {!loading &&
          tasks.map((task) => (
            <div
              key={task.task_id}
              className="grid grid-cols-1 gap-3 rounded-xl border border-border bg-card p-4 md:grid-cols-6 md:items-center"
            >
              <div className="md:col-span-2">
                <input
                  value={task.title}
                  onChange={(e) =>
                    setTasks((prev) =>
                      prev.map((t) =>
                        t.task_id === task.task_id
                          ? {
                              ...t,
                              title: e.target.value,
                            }
                          : t
                      )
                    )
                  }
                  onBlur={(e) => updateTask(task.task_id, { title: e.target.value }, orgId)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.currentTarget.blur();
                    }
                  }}
                  disabled={!canManage}
                  className="w-full bg-transparent text-[15px] font-medium text-foreground outline-none disabled:cursor-default"
                />
                <select
                  value={task.project_id ?? ""}
                  onChange={(e) => handleProjectChange(task.task_id, e.target.value || null)}
                  disabled={!canManage}
                  className="mt-0.5 bg-transparent text-sm text-muted-foreground outline-none disabled:cursor-default"
                >
                  <option value="">No project</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  value={(task.status ?? "todo") as TaskStatus}
                  onChange={(e) => handleStatusChange(task.task_id, e.target.value as TaskStatus)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  disabled={!canManage}
                >
                  <option value="todo">To Do</option>
                  <option value="in_progress">In Progress</option>
                  <option value="blocked">Blocked</option>
                  <option value="done">Completed</option>
                </select>
              </div>

              <div>
                <input
                  type="date"
                  value={task.due_date ?? ""}
                  onChange={(e) => handleDueDateChange(task.task_id, e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  disabled={!canManage}
                />
              </div>

              <div className="text-sm text-muted-foreground md:col-span-2">
                Hours: {task.allocated_hours ?? "-"}
              </div>
            </div>
          ))}
      </div>

      {showCreate && canManage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={(e) => e.currentTarget === e.target && setShowCreate(false)}
        >
          <div className="w-full max-w-md space-y-4 rounded-xl border border-border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-foreground">Create Task</h2>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                placeholder="Task title"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Due date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Project (optional)</label>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">No project</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowCreate(false)} disabled={creating}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={creating || !title.trim() || !dueDate}>
                {creating ? "Creating..." : "Create"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
