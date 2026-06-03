"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { createTask } from "@/actions/task/create";
import { updateTask } from "@/actions/task/update";
import { assignTaskToResource } from "@/actions/task/assign";
import { deleteTask as deleteTaskAction } from "@/actions/task/delete";
import { listOrgMembers } from "@/actions/organization/listOrgMembers";
import { supabase } from "@/lib/supabase/client";
import { useOrgRole } from "@/hooks/useOrgRole";
import { getWorkspaceCapabilities } from "@/lib/auth/ui-capabilities";
import { isAppRole, toAppRole } from "@/lib/auth/permissions";
import { usePageHeader } from "@/components/layout/PageHeaderContext";
import { Button } from "@/components/ui/button";
import { ExpandableDescription } from "@/components/tasks/ExpandableDescription";
import { TaskSelectionIndicator } from "@/components/tasks/TaskSelectionIndicator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/providers/toast";
import type { Enums } from "@/lib/types/database";

type EmployeeTask = {
  task_id: string;
  title: string;
  status: TaskStatus | null;
  description: string | null;
  due_date: string | null;
  project_id: string | null;
  allocated_hours: number | null;
};

type ProjectOption = {
  id: string;
  name: string;
};

type TaskStatus = Enums<"task_status">;

type EmployeeTaskRowProps = {
  task: EmployeeTask;
  canManage: boolean;
  canEditStatus: boolean;
  deleteMode: boolean;
  selectedForDelete: boolean;
  projects: ProjectOption[];
  onDraftUpdate: (taskId: string, updates: Partial<EmployeeTask>) => void;
  onToggleDeleteSelection: (taskId: string) => void;
  onTitleCommit: (taskId: string, nextTitle: string) => void;
  onDescriptionCommit: (taskId: string, nextDescription: string) => void;
  onStatusChange: (taskId: string, status: TaskStatus) => void;
  onDueDateChange: (taskId: string, nextDueDate: string) => void;
  onProjectChange: (taskId: string, projectId: string | null) => void;
};

type TaskJoinRow = {
  id: string;
  title: string;
  status: TaskStatus | null;
  description: string | null;
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
        description: joinedTask.description,
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

const EmployeeTaskRow = memo(function EmployeeTaskRow({
  task,
  canManage,
  canEditStatus,
  deleteMode,
  selectedForDelete,
  projects,
  onDraftUpdate,
  onToggleDeleteSelection,
  onTitleCommit,
  onDescriptionCommit,
  onStatusChange,
  onDueDateChange,
  onProjectChange,
}: EmployeeTaskRowProps) {
  const gridClassName = "md:grid-cols-[48px_minmax(0,2fr)_200px_140px_140px]";

  const containerClassName = deleteMode
    ? selectedForDelete
      ? "cursor-pointer border-red-200 bg-red-50/70 shadow-sm hover:bg-red-50/80"
      : "cursor-pointer border-zinc-100 bg-white hover:border-red-200 hover:bg-red-50/30"
    : "border-zinc-100 bg-white hover:bg-zinc-50/50";
  const fieldsDisabled = !canManage || deleteMode;
  const statusDisabled = deleteMode || (!canManage && !canEditStatus);

  return (
    <div
      role={deleteMode ? "button" : undefined}
      tabIndex={deleteMode ? 0 : undefined}
      aria-selected={deleteMode ? selectedForDelete : undefined}
      className={`group flex flex-col items-start gap-2.5 border-t px-4 py-3.5 transition-colors first:border-t-0 md:grid ${gridClassName} md:items-center md:gap-4 md:py-3 ${containerClassName}`}
      onClick={deleteMode ? () => onToggleDeleteSelection(task.task_id) : undefined}
      onKeyDown={
        deleteMode
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onToggleDeleteSelection(task.task_id);
              }
            }
          : undefined
      }
    >
      <div className="flex w-full justify-center pt-0.5 md:pt-0">
        <TaskSelectionIndicator selected={deleteMode ? selectedForDelete : task.status === "done"} deleteMode={deleteMode} />
      </div>

      <div className="flex w-full min-w-0 flex-col">
        <input
          value={task.title}
          onChange={(event) => onDraftUpdate(task.task_id, { title: event.target.value })}
          onBlur={(event) => {
            onTitleCommit(task.task_id, event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.currentTarget.blur();
            }
          }}
          disabled={fieldsDisabled}
          className={`w-full truncate bg-transparent text-[15px] font-medium outline-none disabled:cursor-default ${
            deleteMode && selectedForDelete ? "line-through text-red-900/80" : "text-foreground"
          } ${deleteMode ? "opacity-90" : ""}`}
        />
        <ExpandableDescription
          value={task.description ?? ""}
          onChange={(nextValue) => onDraftUpdate(task.task_id, { description: nextValue })}
          onCommit={(nextValue) => {
            onDescriptionCommit(task.task_id, nextValue);
          }}
          disabled={fieldsDisabled}
          className={`mt-1 ${deleteMode ? "opacity-90" : ""}`}
        />
      </div>

      <div className="flex w-full items-center">
        <Select
          value={task.project_id ?? "__none__"}
          onValueChange={(value) => {
            onProjectChange(task.task_id, value === "__none__" ? null : value);
          }}
          disabled={fieldsDisabled}
        >
          <SelectTrigger className={`h-7 w-full border-none bg-transparent px-0 text-xs text-zinc-500 shadow-none focus-visible:ring-0 ${deleteMode ? "opacity-90" : ""}`}>
            <SelectValue placeholder="No workspace" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">No workspace</SelectItem>
            {projects.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center">
        <Select
          value={(task.status ?? "todo") as TaskStatus}
          onValueChange={(value) => {
            onStatusChange(task.task_id, value as TaskStatus);
          }}
          disabled={statusDisabled}
        >
          <SelectTrigger className={`h-8 w-full min-w-32 bg-background text-xs ${deleteMode ? "opacity-85" : ""}`}>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todo">To Do</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="blocked">Blocked</SelectItem>
            <SelectItem value="done">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center">
        <input
          type="date"
          value={task.due_date ?? ""}
          onChange={(event) => {
            onDraftUpdate(task.task_id, { due_date: event.target.value || null });
            onDueDateChange(task.task_id, event.target.value);
          }}
          className={`h-8 w-full min-w-36 rounded-md border border-input bg-background px-3 text-xs ${deleteMode ? "opacity-85" : ""}`}
          disabled={fieldsDisabled}
        />
      </div>
    </div>
  );
});

// POSSIBLE LARGE CLIENT COMPONENT
export default function EmployeeTasksPage() {
  const role = useOrgRole();
  const appRole = role && isAppRole(role) ? toAppRole(role) : null;
  const canManage = appRole ? getWorkspaceCapabilities(appRole).canManageTasks : false;
  const canEditOwnAssignedStatus = appRole
    ? getWorkspaceCapabilities(appRole).canUpdateAssignedTaskStatus
    : false;
  const { addToast } = useToast();
  const { setPageHeader } = usePageHeader();

  const { orgId, employeeId } = useParams<{ orgId: string; employeeId: string }>();
  const hydrationStartRef = useRef<number | null>(null);
  const renderCountRef = useRef(0);
  const [tasks, setTasks] = useState<EmployeeTask[]>([]);
  const [employeeName, setEmployeeName] = useState("Employee");
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id ?? null);
    });
  }, []);

  useEffect(() => {
    hydrationStartRef.current = performance.now();
    console.time("[perf] page employee-tasks hydration");
    console.timeEnd("[perf] page employee-tasks hydration");
  }, []);

  useEffect(() => {
    renderCountRef.current += 1;
    if (renderCountRef.current > 1) {
      console.info(
        `[render] employee-tasks #${renderCountRef.current} tasks=${tasks.length} loading=${loading} deleteMode=${deleteMode}`
      );
    }
  }, [deleteMode, loading, tasks.length]);

  const fetchEmployeeTasks = useCallback(async () => {
    const queryStart = performance.now();
    const { data } = await supabase
      .from("assignments")
      .select(
        `
          task_id,
          allocated_hours,
            tasks!inner(id, title, status, description, due_date, project_id, deleted_at)
        `
      )
      .eq("organization_id", orgId)
      .eq("user_id", employeeId)
      .is("tasks.deleted_at", null);

    console.info(
      `[perf] employee-tasks assignments query ${(performance.now() - queryStart).toFixed(1)}ms`
    );

    const mapStart = performance.now();
    const result = mapAssignmentRowsToEmployeeTasks((data ?? []) as AssignmentTaskRow[]);
    const mapMs = performance.now() - mapStart;
    if (mapMs > 12) {
      console.info(`[perf] employee-tasks map tasks ${mapMs.toFixed(1)}ms`);
    }
    return result;
  }, [employeeId, orgId]);

  const selectedTaskIdSet = useMemo(() => new Set(selectedTaskIds), [selectedTaskIds]);

  const updateTaskInState = useCallback((taskId: string, updates: Partial<EmployeeTask>) => {
    setTasks((prev) => prev.map((task) => (task.task_id === taskId ? { ...task, ...updates } : task)));
  }, []);

  const toggleDeleteMode = useCallback(() => {
    setDeleteMode(true);
    setSelectedTaskIds([]);
  }, []);

  const cancelDeleteMode = useCallback(() => {
    setDeleteMode(false);
    setSelectedTaskIds([]);
  }, []);

  const toggleTaskSelection = useCallback((taskId: string) => {
    setSelectedTaskIds((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]
    );
  }, []);

  const handleBulkDelete = useCallback(async () => {
    if (!selectedTaskIds.length) {
      return;
    }

    const taskIdsToDelete = [...selectedTaskIds];
    const previousTasks = tasks;

    setTasks((prev) => prev.filter((task) => !taskIdsToDelete.includes(task.task_id)));
    setDeleteMode(false);
    setSelectedTaskIds([]);

    try {
      await Promise.all(taskIdsToDelete.map((taskId) => deleteTaskAction(taskId, orgId)));
      addToast(`${taskIdsToDelete.length} task${taskIdsToDelete.length === 1 ? "" : "s"} deleted`, "success");
    } catch {
      const refreshedTasks = await fetchEmployeeTasks().catch(() => previousTasks);
      setTasks(refreshedTasks);
      setDeleteMode(true);
      setSelectedTaskIds(taskIdsToDelete.filter((taskId) => refreshedTasks.some((task) => task.task_id === taskId)));
      addToast("Failed to delete selected tasks", "error");
    }
  }, [addToast, fetchEmployeeTasks, orgId, selectedTaskIds, tasks]);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const loadStart = performance.now();

        const membersStart = performance.now();
        const members = await listOrgMembers(orgId);
        console.info(
          `[perf] employee-tasks listOrgMembers ${(performance.now() - membersStart).toFixed(1)}ms`
        );
        const match = members.data?.find((m) => m.user_id === employeeId);
        if (match) {
          setEmployeeName(match.name);
        }

        const tasksStart = performance.now();
        const normalizedTasks = await fetchEmployeeTasks();
        console.info(
          `[perf] employee-tasks fetchEmployeeTasks ${(performance.now() - tasksStart).toFixed(1)}ms`
        );

        setTasks(normalizedTasks);

        // POTENTIAL WATERFALL
        const projectsStart = performance.now();
        const { data: projectData } = await supabase
          .from("projects")
          .select("id, name")
          .eq("organization_id", orgId)
          .is("deleted_at", null)
          .order("name", { ascending: true });

        console.info(
          `[perf] employee-tasks projects query ${(performance.now() - projectsStart).toFixed(1)}ms`
        );

        setProjects((projectData ?? []).map((p) => ({ id: p.id, name: p.name })));
        console.info(
          `[perf] employee-tasks load total ${(performance.now() - loadStart).toFixed(1)}ms`
        );
      } finally {
        setLoading(false);
      }
    }

    if (orgId && employeeId) {
      void load();
    }
  }, [orgId, employeeId, fetchEmployeeTasks]);

  useEffect(() => {
    setPageHeader(
      <div className="flex w-full flex-wrap items-center justify-between gap-3 md:flex-nowrap">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold tracking-tight text-zinc-900">Tasks · {employeeName}</h1>
          <p className="text-xs text-zinc-500">
            {deleteMode ? `${selectedTaskIds.length} selected for deletion` : "Assigned tasks across projects"}
          </p>
        </div>

        {canManage && (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              className="h-8 border-transparent bg-indigo-600 px-3.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
              onClick={() => setShowCreate(true)}
            >
              <Plus className="mr-2 h-4 w-4 opacity-90" />
              Add Task
            </Button>

            {!deleteMode ? (
              <Button
                variant="outline"
                className="h-8 border-red-200 bg-white px-3 text-sm font-medium text-red-700 shadow-sm hover:bg-red-50"
                onClick={toggleDeleteMode}
                disabled={tasks.length === 0}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Tasks
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  className="h-8 border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50"
                  onClick={cancelDeleteMode}
                >
                  Cancel
                </Button>
                <Button
                  className="h-8 bg-red-600 px-3 text-sm font-medium text-white shadow-sm hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                  onClick={() => {
                    void handleBulkDelete();
                  }}
                  disabled={selectedTaskIds.length === 0}
                >
                  Delete Selected{selectedTaskIds.length ? ` (${selectedTaskIds.length})` : ""}
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    );

    return () => {
      setPageHeader(null);
    };
  }, [canManage, cancelDeleteMode, deleteMode, employeeName, handleBulkDelete, selectedTaskIds.length, setPageHeader, tasks.length, toggleDeleteMode]);

  async function handleCreate() {
    if (!title.trim() || !dueDate) {
      return;
    }

    try {
      setCreating(true);
      const created = await createTask(
        title.trim(),
        description.trim() || undefined,
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
          description: created.description,
          due_date: created.due_date,
          project_id: created.project_id,
          allocated_hours: null,
        },
        ...prev,
      ]);

      setTitle("");
      setDescription("");
      setDueDate("");
      setSelectedProjectId("");
      setShowCreate(false);
      addToast("Task created", "success");
    } catch {
      addToast("Failed to create task", "error");
    } finally {
      setCreating(false);
    }
  }

  async function handleTitleCommit(taskId: string, nextTitle: string) {
    const previousTasks = tasks;
    updateTaskInState(taskId, { title: nextTitle });

    try {
      await updateTask(taskId, { title: nextTitle }, orgId);
    } catch {
      setTasks(await fetchEmployeeTasks().catch(() => previousTasks));
      addToast("Failed to update title", "error");
    }
  }

  async function handleDescriptionCommit(taskId: string, nextDescription: string) {
    const previousTasks = tasks;
    updateTaskInState(taskId, { description: nextDescription || null });

    try {
      await updateTask(taskId, { description: nextDescription || null }, orgId);
    } catch {
      setTasks(await fetchEmployeeTasks().catch(() => previousTasks));
      addToast("Failed to update description", "error");
    }
  }

  async function handleStatusChange(taskId: string, status: TaskStatus) {
    const previousTasks = tasks;
    updateTaskInState(taskId, { status });

    try {
      await updateTask(taskId, { status }, orgId);
    } catch {
      setTasks(await fetchEmployeeTasks().catch(() => previousTasks));
      addToast("Failed to update status", "error");
    }
  }

  async function handleDueDateChange(taskId: string, nextDueDate: string) {
    const previousTasks = tasks;
    updateTaskInState(taskId, { due_date: nextDueDate || null });

    try {
      await updateTask(taskId, { due_date: nextDueDate || null }, orgId);
    } catch {
      setTasks(await fetchEmployeeTasks().catch(() => previousTasks));
      addToast("Failed to update due date", "error");
    }
  }

  async function handleProjectChange(taskId: string, projectId: string | null) {
    const previousTasks = tasks;
    updateTaskInState(taskId, { project_id: projectId });

    try {
      await updateTask(taskId, { project_id: projectId }, orgId);
    } catch {
      setTasks(await fetchEmployeeTasks().catch(() => previousTasks));
      addToast("Failed to update project", "error");
    }
  }

  return (
    <div className="flex w-full max-w-5xl flex-col gap-2 pb-12">
      <section>
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
          <div className="hidden grid-cols-[48px_minmax(0,2fr)_200px_140px_140px] items-center gap-4 border-b border-zinc-200/80 bg-zinc-50/80 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-zinc-500 md:grid">
            <div className="flex justify-center">
              <span className="sr-only">Select Task</span>
            </div>
            <div>Task</div>
            <div>Assigned Workspace</div>
            <div>Status</div>
            <div>Due Date</div>
          </div>

          <div className="flex flex-col">
            {loading && (
              <div className="px-4 py-4 text-sm text-zinc-500">Loading tasks...</div>
            )}

            {!loading && tasks.length === 0 && (
              <div className="px-4 py-4 text-sm text-zinc-500">No tasks assigned to this employee.</div>
            )}

            {!loading &&
              tasks.map((task) => {
                return (
                  <EmployeeTaskRow
                    key={task.task_id}
                    task={task}
                    canManage={canManage}
                    canEditStatus={canEditOwnAssignedStatus && currentUserId === employeeId}
                    deleteMode={deleteMode}
                    selectedForDelete={selectedTaskIdSet.has(task.task_id)}
                    projects={projects}
                    onDraftUpdate={updateTaskInState}
                    onToggleDeleteSelection={toggleTaskSelection}
                    onTitleCommit={handleTitleCommit}
                    onDescriptionCommit={handleDescriptionCommit}
                    onStatusChange={handleStatusChange}
                    onDueDateChange={handleDueDateChange}
                    onProjectChange={handleProjectChange}
                  />
                );
              })}
          </div>
        </div>
      </section>

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
              <label className="text-sm font-medium text-muted-foreground">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                placeholder="Add task details"
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
              <Select
                value={selectedProjectId || "__none__"}
                onValueChange={(value) => setSelectedProjectId(value === "__none__" ? "" : value)}
              >
                <SelectTrigger className="h-9 w-full bg-background text-sm">
                  <SelectValue placeholder="No project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No project</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
