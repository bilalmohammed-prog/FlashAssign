"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Calendar, ClipboardList, ArrowUpDown } from "lucide-react";
import { listMyTasks } from "@/actions/task/listMyTasks";
import { updateTask } from "@/actions/task/update";
import { useOrgRole } from "@/hooks/useOrgRole";
import { usePageHeader } from "@/components/layout/PageHeaderContext";
import type { Enums } from "@/lib/types/database";
import type { MyTaskListItem } from "@/services/task/myTasks.service";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

type TaskStatus = Enums<"task_status">;
type StatusFilter = "all" | TaskStatus;
type DueSort = "asc" | "desc";

function getTaskStatusLabel(status: TaskStatus) {
  if (status === "in_progress") return "In Progress";
  if (status === "done") return "Completed";
  if (status === "blocked") return "Blocked";
  return "To Do";
}

function getTaskStatusBadgeClass(status: TaskStatus) {
  if (status === "done") {
    return "bg-emerald-50 text-emerald-700 border-emerald-200/60";
  }

  if (status === "in_progress") {
    return "bg-indigo-50 text-indigo-700 border-indigo-200/60";
  }

  if (status === "blocked") {
    return "bg-amber-50 text-amber-700 border-amber-200/60";
  }

  return "bg-zinc-100 text-zinc-700 border-zinc-200/60";
}

function formatDueDate(value: string | null) {
  if (!value) return "No due date";
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isOverdue(task: MyTaskListItem) {
  if (!task.due_date || task.status === "done") return false;

  const dueDate = new Date(task.due_date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return dueDate < today;
}

export default function MyTasksPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const role = useOrgRole();
  const canUpdateStatus = role !== null;
  const { setPageHeader } = usePageHeader();

  const [tasks, setTasks] = useState<MyTaskListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [dueSort, setDueSort] = useState<DueSort>("asc");

  useEffect(() => {
    let cancelled = false;

    async function loadMyTasks() {
      if (!orgId) return;

      setTasks([]);
      setError(null);
      setLoading(true);

      try {
        const data = await listMyTasks(orgId);
        if (!cancelled) {
          setTasks(data);
        }
      } catch {
        if (!cancelled) {
          setError("Failed to load your tasks. Please try again.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadMyTasks();

    return () => {
      cancelled = true;
    };
  }, [orgId]);

  const projectOptions = useMemo(() => {
    const seen = new Set<string>();
    const options: Array<{ id: string; name: string }> = [];

    for (const task of tasks) {
      if (!seen.has(task.project_id)) {
        seen.add(task.project_id);
        options.push({ id: task.project_id, name: task.project_name });
      }
    }

    return options.sort((a, b) => a.name.localeCompare(b.name));
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    const byFilter = tasks.filter((task) => {
      const statusMatch = statusFilter === "all" || task.status === statusFilter;
      const projectMatch = projectFilter === "all" || task.project_id === projectFilter;
      return statusMatch && projectMatch;
    });

    const sorted = [...byFilter].sort((a, b) => {
      const aDue = a.due_date ? new Date(a.due_date).getTime() : Number.POSITIVE_INFINITY;
      const bDue = b.due_date ? new Date(b.due_date).getTime() : Number.POSITIVE_INFINITY;

      return dueSort === "asc" ? aDue - bDue : bDue - aDue;
    });

    return sorted;
  }, [tasks, statusFilter, projectFilter, dueSort]);

  const summary = useMemo(() => {
    const total = tasks.length;
    const todo = tasks.filter((task) => task.status === "todo").length;
    const inProgress = tasks.filter((task) => task.status === "in_progress").length;
    const blocked = tasks.filter((task) => task.status === "blocked").length;
    const done = tasks.filter((task) => task.status === "done").length;

    return { total, todo, inProgress, blocked, done };
  }, [tasks]);

  async function handleStatusChange(taskId: string, status: TaskStatus) {
    const previous = tasks;

    setTasks((prev) => prev.map((task) => (task.id === taskId ? { ...task, status } : task)));
    setSavingId(taskId);

    try {
      await updateTask(taskId, { status }, orgId);
    } catch {
      setTasks(previous);
      setError("Unable to update task status right now.");
    } finally {
      setSavingId(null);
    }
  }

  useEffect(() => {
    setPageHeader(
      <div className="flex w-full flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold tracking-tight text-zinc-900">My Tasks</h1>
          <p className="text-xs text-zinc-500">All tasks assigned to you across projects</p>
        </div>

        <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
          <div className="relative w-full max-w-[220px]">
            <input
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              placeholder="Search projects"
              className="h-8 w-full rounded-md border border-zinc-200 bg-white px-3 text-xs text-zinc-700 outline-none transition-colors focus:border-transparent focus:ring-2 focus:ring-indigo-500"
              list="project-options"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="h-8 rounded-md border border-zinc-200 bg-white px-2.5 text-xs text-zinc-700 outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All statuses</option>
            <option value="todo">To Do</option>
            <option value="in_progress">In Progress</option>
            <option value="blocked">Blocked</option>
            <option value="done">Completed</option>
          </select>
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="h-8 rounded-md border border-zinc-200 bg-white px-2.5 text-xs text-zinc-700 outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Projects</option>
            {projectOptions.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          <Button
            type="button"
            variant="outline"
            onClick={() => setDueSort((prev) => (prev === "asc" ? "desc" : "asc"))}
            className="h-8 border-zinc-200 px-2.5 text-xs text-zinc-700"
          >
            <ArrowUpDown className="mr-2 h-4 w-4" />
            {dueSort === "asc" ? "Earliest" : "Latest"}
          </Button>
        </div>
      </div>
    );

    return () => {
      setPageHeader(null);
    };
  }, [dueSort, projectFilter, projectOptions, setPageHeader, statusFilter]);

  return (
    <div className="flex w-full max-w-6xl flex-col gap-6 pb-12">
      <datalist id="project-options">
        {projectOptions.map((project) => (
          <option key={project.id} value={project.id}>
            {project.name}
          </option>
        ))}
      </datalist>

      <div className="flex flex-wrap gap-2 rounded-xl border border-zinc-200/80 bg-white p-4 shadow-[0_1px_3px_0_rgba(0,0,0,0.02)]">
        <div className="rounded-lg border border-zinc-200/70 bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
          <span className="font-semibold text-zinc-900">Total:</span> {summary.total}
        </div>
        <div className="rounded-lg border border-zinc-200/70 bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
          <span className="font-semibold text-zinc-900">To Do:</span> {summary.todo}
        </div>
        <div className="rounded-lg border border-zinc-200/70 bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
          <span className="font-semibold text-zinc-900">In Progress:</span> {summary.inProgress}
        </div>
        <div className="rounded-lg border border-zinc-200/70 bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
          <span className="font-semibold text-zinc-900">Blocked:</span> {summary.blocked}
        </div>
        <div className="rounded-lg border border-zinc-200/70 bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
          <span className="font-semibold text-zinc-900">Completed:</span> {summary.done}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-zinc-200/80 bg-white shadow-[0_1px_3px_0_rgba(0,0,0,0.02)]">
        <div className="hidden grid-cols-[220px_minmax(260px,1fr)_170px_160px] items-center gap-4 border-b border-zinc-200/80 px-4 py-3 text-sm font-semibold text-zinc-500 md:grid">
          <div>Project</div>
          <div>Task</div>
          <div>Status</div>
          <div>Due Date</div>
        </div>

        <div className="flex flex-col divide-y divide-zinc-200/80">
          {loading ? (
            Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="grid grid-cols-1 gap-3 px-4 py-3 md:grid-cols-[220px_minmax(260px,1fr)_170px_160px] md:items-center"
              >
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-8 w-28" />
                <Skeleton className="h-5 w-24" />
              </div>
            ))
          ) : filteredTasks.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-zinc-200 bg-zinc-50/60 p-8 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full border border-indigo-200 bg-indigo-50">
                <ClipboardList className="h-7 w-7 text-indigo-600" />
              </div>
              <h2 className="text-base font-semibold text-zinc-900">No tasks assigned to you yet</h2>
              <p className="max-w-sm text-sm text-zinc-500">
                When tasks are assigned to you in this organization, they will appear here.
              </p>
            </div>
          ) : (
            filteredTasks.map((task) => (
              <div
                key={task.id}
                className="grid grid-cols-1 gap-3 px-4 py-3 transition-colors hover:bg-zinc-50/60 md:grid-cols-[220px_minmax(260px,1fr)_170px_160px] md:items-center"
              >
                <div className="text-sm font-medium text-zinc-700 truncate" title={task.project_name}>
                  {task.project_name}
                </div>

                <div className="text-sm font-medium text-zinc-900">{task.title}</div>

                <div className="flex flex-col gap-1">
                  <select
                    disabled={!canUpdateStatus || savingId === task.id}
                    value={task.status}
                    onChange={(e) => handleStatusChange(task.id, e.target.value as TaskStatus)}
                    className={`w-fit appearance-none rounded-md border px-2.5 py-1 text-[13px] font-medium outline-none disabled:opacity-60 ${getTaskStatusBadgeClass(task.status)}`}
                  >
                    <option value="todo">To Do</option>
                    <option value="in_progress">In Progress</option>
                    <option value="blocked">Blocked</option>
                    <option value="done">Completed</option>
                  </select>
                  {savingId === task.id && <span className="text-xs text-zinc-500">Saving...</span>}
                </div>

                <div
                  className={`flex items-center gap-1.5 text-sm ${isOverdue(task) ? "font-semibold text-red-600" : "text-zinc-600"}`}
                >
                  <Calendar className="h-3.5 w-3.5" />
                  {formatDueDate(task.due_date)}
                </div>

                <div className="md:hidden">
                  <span className="text-xs text-zinc-500">{getTaskStatusLabel(task.status)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
