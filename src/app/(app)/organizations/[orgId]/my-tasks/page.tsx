"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import {
  ArrowRight,
  Calendar,
  Plus,
  Search,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Trash2,
  X,
} from "lucide-react";
import type { Enums, TablesUpdate } from "@/lib/types/database";
import { updateTask } from "@/actions/task/update";
import { createTask } from "@/actions/task/create";
import { deleteTask as deleteTaskAction } from "@/actions/task/delete";
import { assignTaskToResource } from "@/actions/task/assign";
import { usePageHeader } from "@/components/layout/PageHeaderContext";
import { Button } from "@/components/ui/button";
import { AppModal } from "@/components/ui/app-modal";
import { Input } from "@/components/ui/input";
import { ExpandableDescription } from "@/components/tasks/ExpandableDescription";
import { useToast } from "@/components/providers/toast";
import { getWorkspaceCapabilities, canEditTask } from "@/lib/auth/ui-capabilities";
import { isAppRole, toAppRole } from "@/lib/auth/permissions";
import { supabase } from "@/lib/supabase/client";
import { useOrgRole } from "@/hooks/useOrgRole";
import { DatePicker } from "@/components/ui/date-picker";

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

type TaskPatch = {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  start_date?: string | null;
  due_date?: string | null;
  project_id?: string | null;
  project_name?: string | null;
};

type TaskStatus = Enums<"task_status">;
type ProjectResource = { id: string; name: string };

const PAGE_SIZE = 10;
const desktopTasksTableGrid =
  "md:grid-cols-[minmax(0,1.8fr)_220px_152px_140px_140px_48px]";

type TaskRowProps = {
  task: EmployeeTaskRpc;
  canManage: boolean;
  canEditStatus: boolean;
  deleteMode: boolean;
  selectedForDelete: boolean;
  projects: ProjectResource[];
  savingId: string | null;
  onCommitUpdate: (taskId: string, updates: TablesUpdate<"tasks">) => void;
  onProjectChange: (taskId: string, projectId: string | null) => void;
  onToggleDeleteSelection: (taskId: string) => void;
};

function isTaskOverdue(task: { due_date?: string | null; status?: string }): boolean {
  if (!task.due_date) return false;
  if (task.status === "completed" || task.status === "done") return false;

  const dueDate = new Date(task.due_date);
  const now = new Date();

  dueDate.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);

  return dueDate < now;
}

const EmployeeTaskRow = memo(function EmployeeTaskRow({
  task,
  canManage,
  canEditStatus,
  deleteMode,
  selectedForDelete,
  projects,
  savingId,
  onCommitUpdate,
  onProjectChange,
  onToggleDeleteSelection,
}: TaskRowProps) {
  const [titleValue, setTitleValue] = useState(task.title);
  const [descriptionValue, setDescriptionValue] = useState(task.description ?? "");

  const fieldsDisabled = !canManage || deleteMode;
  const statusDisabled = deleteMode || (!canManage && !canEditStatus);
  const rowClassName = selectedForDelete
    ? "border-red-200 bg-red-50/70 hover:bg-red-50/80"
    : "border-zinc-100 bg-white hover:bg-zinc-100/60";
  const overdue = isTaskOverdue(task);

  return (
    <div
      className={`group relative flex flex-col items-start gap-3 px-4 py-4 transition-colors md:grid md:items-center md:gap-4 md:px-6 md:py-3.5 ${desktopTasksTableGrid} ${rowClassName}`}
    >
      <div className="flex w-full min-w-0 flex-col">
        <input
          value={titleValue}
          onChange={(e) => setTitleValue(e.target.value)}
          onBlur={(e) => {
            if (e.target.value !== task.title) {
              onCommitUpdate(task.id, { title: e.target.value });
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          disabled={fieldsDisabled}
          className={`w-full truncate rounded px-1.5 py-0.5 text-[15px] font-medium outline-none transition-colors disabled:cursor-default
            ${
              !fieldsDisabled
                ? "border border-transparent hover:border-zinc-300 hover:bg-zinc-50 focus:border-transparent focus:bg-white focus:ring-2 focus:ring-indigo-500 cursor-text"
                : "bg-transparent border-transparent"
            }
            ${
              selectedForDelete
                ? "line-through text-red-950/80 opacity-90"
                : task.status === "done"
                ? "text-zinc-900"
                : "text-zinc-900"
            }
          `}
        />
        <ExpandableDescription
          value={descriptionValue}
          onChange={(nextValue) => setDescriptionValue(nextValue)}
          onCommit={(nextValue) => {
            if (nextValue !== (task.description ?? "")) {
              onCommitUpdate(task.id, { description: nextValue.trim() ? nextValue : null });
            }
          }}
          disabled={fieldsDisabled}
          className={`mt-1 ${selectedForDelete ? "opacity-90" : ""}`}
        />
        <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-zinc-500 md:hidden">
          <span
            className={`rounded px-2 py-0.5 text-xs font-medium ${getTaskStatusBadgeClass(
              task.status
            )} ${selectedForDelete ? "opacity-90" : ""}`}
          >
            {getTaskStatusLabel(task.status)}
          </span>
          <span className={selectedForDelete ? "opacity-90" : ""}>
            Start: {formatDateLabel(task.start_date, "No start date")}
          </span>
          <span className={selectedForDelete ? "opacity-90" : ""}>
            Due: {formatDateLabel(task.due_date, "No due date")}
          </span>
          {savingId === task.id && <span>Saving...</span>}
        </div>
      </div>

      <div className="flex w-full items-center gap-2.5">
        <select
          value={task.project_id || ""}
          onChange={(e) => onProjectChange(task.id, e.target.value || null)}
          disabled={fieldsDisabled}
          className={`cursor-pointer min-w-0 flex-1 appearance-none bg-transparent text-sm font-medium outline-none disabled:cursor-default ${
            task.project_id ? "text-zinc-900" : "italic text-zinc-400"
          } ${selectedForDelete ? "opacity-90" : ""}`}
        >
          <option value="">No workspace</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </div>

      <div className="hidden md:flex md:flex-col md:items-start md:gap-2">
        <select
          value={task.status ?? "todo"}
          onChange={(e) => {
            const value = e.target.value as TaskStatus;
            onCommitUpdate(task.id, { status: value });
          }}
          disabled={statusDisabled}
          className={`appearance-none rounded-md border px-2.5 py-1 text-[13px] font-medium outline-none disabled:cursor-default cursor-pointer transition-all ${getTaskStatusBadgeClass(
            task.status
          )} ${selectedForDelete ? "opacity-90" : ""}`}
        >
          <option value="todo">To Do</option>
          <option value="in_progress">In Progress</option>
          <option value="blocked">Blocked</option>
          <option value="done">Completed</option>
        </select>
        {savingId === task.id && <span className="text-xs text-zinc-500">Saving...</span>}
      </div>

      <div className="hidden min-w-0 md:flex md:h-full md:items-center text-sm text-zinc-500">
        <DatePicker
          disabled={!canManage}
          value={task.start_date || ""}
          variant="ghost"
          className="-ml-0 h-auto px-0 py-0 text-sm font-normal text-zinc-600 hover:bg-transparent hover:text-zinc-900"
          placeholder="Not set"
          ghostPlaceholder
          onChange={async (val) => {
            await onCommitUpdate(task.id, { start_date: val || null });
          }}
        />
      </div>

      <div className="hidden min-w-0 md:flex md:h-full md:items-center">
        <div className="flex items-center gap-2">
          <DatePicker
            disabled={!canManage}
            value={task.due_date || ""}
            danger={overdue}
            variant="ghost"
            className="h-auto px-0 py-0 text-sm font-normal text-zinc-600 hover:bg-transparent hover:text-zinc-900"
            placeholder="Not set"
            ghostPlaceholder
            onChange={async (val) => {
              await onCommitUpdate(task.id, { due_date: val || null });
            }}
          />
        </div>
      </div>

      <div className="flex w-full items-center justify-end md:justify-center">
        {canManage && (
          <button
            type="button"
            onClick={() => onToggleDeleteSelection(task.id)}
            className={`rounded-md p-1.5 transition-all outline-none ${
              selectedForDelete
                ? "text-red-600 bg-red-100 hover:bg-red-200"
                : "text-zinc-400 opacity-40 hover:text-red-600 hover:bg-zinc-100 hover:opacity-100 group-hover:opacity-100"
            }`}
            title="Delete task"
          >
            <Trash2 className="cursor-pointer h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
});

function formatDateLabel(value: string | null, fallback: string) {
  if (!value) return fallback;
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function getTaskStatusLabel(status: string | null) {
  if (status === "in_progress") return "In Progress";
  if (status === "done") return "Completed";
  if (status === "blocked") return "Blocked";
  return "To Do";
}

function getTaskStatusBadgeClass(status: string | null) {
  if (status === "done") return "bg-emerald-50 text-emerald-700 border-emerald-200/60";
  if (status === "in_progress") return "bg-indigo-50 text-indigo-700 border-indigo-200/60";
  if (status === "blocked") return "bg-amber-50 text-amber-700 border-amber-200/60";
  return "bg-zinc-100 text-zinc-700 border-zinc-200/60";
}

export default function MyTasksPage() {
  const role = useOrgRole();
  const appRole = role && isAppRole(role) ? toAppRole(role) : null;
  const capabilities = appRole ? getWorkspaceCapabilities(appRole) : null;
  const canManage = false;

  const { orgId } = useParams<{ orgId: string }>();
  const { addToast } = useToast();

  const [projects, setProjects] = useState<ProjectResource[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Pagination & Server State
  const [tasks, setTasks] = useState<EmployeeTaskRpc[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  // Filter & Sort State
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | TaskStatus>("all");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [startDateFilter, setStartDateFilter] = useState<string>("");
  const [dueDateFilter, setDueDateFilter] = useState<string>("");
  const [sortBy, setSortBy] = useState<"title" | "status" | "start_date" | "due_date">("title");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Modals / Helpers
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  
  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  
  const hasMoreRef = useRef(hasMore);
  const initialLoadingRef = useRef(initialLoading);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const loadingMoreRef = useRef(false);
  const offsetRef = useRef(0);
  const addToastRef = useRef(addToast);
  const isFirstRender = useRef(true);
  const headingRef = useRef<HTMLDivElement>(null);
  const [headingGone, setHeadingGone] = useState(false);
  
  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id ?? null);
    });
  }, []);

  useEffect(() => { addToastRef.current = addToast; }, [addToast]);
  
  useEffect(() => {
    const el = headingRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => setHeadingGone(!entry.isIntersecting),
      { threshold: 0 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Global Page Initialization (Projects)
  useEffect(() => {
    async function loadMeta() {
      if (!orgId) return;
      try {
        const { data: projectsRes } = await supabase
            .from("projects")
            .select("id, name")
            .eq("organization_id", orgId)
            .is("deleted_at", null)
            .order("name", { ascending: true });
        
        if (projectsRes) {
          setProjects(projectsRes.map(p => ({ id: p.id, name: p.name })));
        }
      } catch (err) {
        console.error(err);
      }
    }
    void loadMeta();
  }, [orgId]);

  const fetchTasks = useCallback(async (offset: number, append = false) => {
    if (append && loadingMoreRef.current) return;
    if (!orgId || !currentUserId) return;

    loadingMoreRef.current = true;
    setLoadingMore(true);

    if (!append) {
      initialLoadingRef.current = true;
      setInitialLoading(true);
      offsetRef.current = 0;
    }

    try {
      const { data, error } = await supabase.rpc("list_employee_tasks_with_meta", {
        org_uuid: orgId,
        employee_uuid: currentUserId,
        page_size: PAGE_SIZE,
        page_offset: offset,
        search_query: searchQuery || undefined,
        status_filter: statusFilter !== "all" ? statusFilter : undefined,
        project_filter: projectFilter !== "all" && projectFilter !== "unassigned" ? projectFilter : undefined,
        unassigned_only: projectFilter === "unassigned",
        start_date_from: startDateFilter || undefined,
        due_date_to: dueDateFilter || undefined,
        sort_by: sortBy,
        sort_order: sortOrder,
      });

      if (error) throw error;

      const fetchedTasks = data ?? [];
      const count = fetchedTasks[0]?.total_count ?? 0;
      const newOffset = offset + fetchedTasks.length;

      offsetRef.current = newOffset;
      hasMoreRef.current = newOffset < count;

      setTasks((prev) => (append ? [...prev, ...fetchedTasks] : fetchedTasks));
      setTotalCount(count);
      setHasMore(newOffset < count);
    } catch (err) {
      console.error(err);
      addToastRef.current("Failed to load tasks", "error");
    } finally {
      initialLoadingRef.current = false;
      setInitialLoading(false);
      setLoadingMore(false);
      loadingMoreRef.current = false;
    }
  }, [orgId, currentUserId, searchQuery, statusFilter, projectFilter, startDateFilter, dueDateFilter, sortBy, sortOrder]);

  // Handle updates to server queries across filters
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
    }
    offsetRef.current = 0;
    void fetchTasks(0, false);
  }, [fetchTasks]);

  // Infinite Scroll IntersectionObserver hook
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || loadingMore || initialLoading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);
        void fetchTasks(offsetRef.current, true);
      },
      { rootMargin: "200px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, initialLoading, fetchTasks]);

const canEditStatusForUser = useMemo(
  () =>
    appRole !== null && // Ensure appRole is defined
    Boolean(currentUserId) &&
    canEditTask(appRole, {
      userId: currentUserId!, // Use non-null assertion or check currentUserId
      assigneeId: currentUserId!,
    }),
  [appRole, currentUserId]
);

  const updateTaskInState = useCallback((id: string, updates: TaskPatch) => {
    setTasks(prev =>
      prev.map(task =>
        task.id === id ? { ...task, ...updates } : task
      )
    );
  }, []);

  const commitUpdate = useCallback(
    async (id: string, updates: TablesUpdate<"tasks">) => {
      try {
        setSavingId(id);
        await updateTask(id, updates, orgId);
      } catch {
        addToast("Failed to save task", "error");
      } finally {
        setSavingId(null);
      }
    },
    [addToast, orgId]
  );

  const commitTaskUpdate = useCallback(
    (id: string, updates: TablesUpdate<"tasks">) => {
      const scopedUpdates = canManage
        ? updates
        : canEditStatusForUser && updates.status !== undefined
          ? { status: updates.status }
          : null;

      if (!scopedUpdates) return;

      const patch: TaskPatch = {
        ...scopedUpdates,
        status: scopedUpdates.status ?? undefined,
      };

      updateTaskInState(id, patch);
      void commitUpdate(id, scopedUpdates);
    },
    [canManage, commitUpdate, canEditStatusForUser, updateTaskInState]
  );

  const handleProjectAssignment = useCallback(
    async (taskId: string, projectId: string | null) => {
      try {
        await updateTask(taskId, { project_id: projectId }, orgId);
        const project = projects.find((p) => p.id === projectId);
        updateTaskInState(taskId, {
          project_id: projectId,
          project_name: projectId ? project?.name ?? null : null,
        });
      } catch {
        addToast("Failed to update workspace", "error");
      }
    },
    [addToast, orgId, projects, updateTaskInState]
  );

  function handleSort(column: typeof sortBy) {
    if (sortBy === column) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortOrder("asc");
    }
  }

  function SortIcon(column: typeof sortBy) {
    if (sortBy !== column) return <ArrowUpDown className="h-3.5 w-3.5 text-zinc-400" />;
    return sortOrder === "asc" 
      ? <ArrowUp className="h-3.5 w-3.5 text-indigo-600" /> 
      : <ArrowDown className="h-3.5 w-3.5 text-indigo-600" />;
  }

  const selectedTaskIdSet = useMemo(() => new Set(selectedTaskIds), [selectedTaskIds]);
  
  const cancelDeleteMode = useCallback(() => {
    setDeleteMode(false);
    setSelectedTaskIds([]);
  }, []);

  const toggleTaskSelection = useCallback((taskId: string) => {
    setSelectedTaskIds((prev) => {
      const next = prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId];
      setDeleteMode(next.length > 0);
      return next;
    });
  }, []);
  
  const handleBulkDelete = useCallback(async () => {
    if (selectedTaskIds.length === 0) return;

    const taskIdsToDelete = [...selectedTaskIds];
    const backupTasks = tasks;
    const backupTotal = totalCount;

    setTasks((prev) => prev.filter((task) => !taskIdsToDelete.includes(task.id)));
    setTotalCount((prev) => Math.max(0, prev - taskIdsToDelete.length));
    setDeleteMode(false);
    setSelectedTaskIds([]);

    try {
      await Promise.all(taskIdsToDelete.map((taskId) => deleteTaskAction(taskId, orgId)));
      addToast(`Deleted ${taskIdsToDelete.length} task${taskIdsToDelete.length === 1 ? "" : "s"}`, "success");
    } catch {
      setTasks(backupTasks);
      setTotalCount(backupTotal);
      setDeleteMode(true);
      setSelectedTaskIds(taskIdsToDelete);
      addToast("Failed to delete selected tasks", "error");
    }
  }, [addToast, orgId, selectedTaskIds, tasks, totalCount]);

  async function handleCreate() {
    if (!title.trim() || !currentUserId) return;

    try {
      setCreating(true);
      const created = await createTask(title.trim(), createDescription.trim() || undefined, startDate, dueDate, orgId, selectedProjectId || null);
      
      const optionalUpdates: TablesUpdate<"tasks"> = {};
      if (startDate) {
        optionalUpdates.start_date = startDate;
      }

      if (Object.keys(optionalUpdates).length > 0) {
        await updateTask(created.id, optionalUpdates, orgId);
      }

      await assignTaskToResource(created.id, currentUserId);

      const newTask: EmployeeTaskRpc = {
        id: created.id,
        organization_id: orgId,
        project_id: selectedProjectId || null,
        project_name: projects.find((p) => p.id === selectedProjectId)?.name ?? null,
        title: created.title,
        description: created.description ?? null,
        status: "todo",
        start_date: startDate || null,
        due_date: dueDate || null,
        created_by: currentUserId,
        created_at: new Date().toISOString(),
        total_count: totalCount + 1,
      };

      setTasks((prev) => [newTask, ...prev]);
      setTotalCount((prev) => prev + 1);
      setTitle("");
      setCreateDescription("");
      setStartDate("");
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

  const tasksToolbar = (
    <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full flex-1 max-w-xl">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input
            placeholder="Search tasks"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 border-zinc-200 bg-white pl-9 text-sm text-zinc-700 placeholder:text-zinc-500 focus-visible:ring-2 focus-visible:ring-indigo-500 border-zinc-300 shadow-sm"
          />
        </div>
        <select
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          className="h-9 w-full cursor-pointer rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-700 shadow-sm outline-none transition-colors focus:border-transparent focus:ring-2 focus:ring-indigo-500 sm:w-44"
        >
          <option value="all">Any workspace</option>
          <option value="unassigned">No workspace</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as "all" | TaskStatus)}
          className="h-9 w-full cursor-pointer rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-700 shadow-sm outline-none transition-colors focus:border-transparent focus:ring-2 focus:ring-indigo-500 sm:w-44"
        >
          <option value="all">All statuses</option>
          <option value="todo">To Do</option>
          <option value="in_progress">In Progress</option>
          <option value="blocked">Blocked</option>
          <option value="done">Completed</option>
        </select>

        

        <div className="flex items-center gap-2">
          <DatePicker
              value={startDateFilter || null}
              onChange={(value) => setStartDateFilter(value ?? "")}
              placeholder="Start date"
              className="h-9 w-[150px] justify-start border-zinc-300 bg-white px-3 text-sm font-normal shadow-sm hover:bg-white"
          />

          <ArrowRight className="h-4 w-4 text-zinc-400" />

          <DatePicker
              value={dueDateFilter || null}
              onChange={(value) => setDueDateFilter(value ?? "")}
              placeholder="Due date"
              className="h-9 w-[150px] justify-start border-zinc-300 bg-white px-3 text-sm font-normal shadow-sm hover:bg-white"
          />
        </div>
      </div>

    </div>
  );

  return (
    <div className="flex w-full flex-col gap-4 pb-12">
      <div className="flex items-start justify-between gap-4">
        <div ref={headingRef} className="space-y-1">
          <h1
            className="text-2xl font-semibold tracking-tight text-zinc-900 truncate max-w-[640px]"
          >
            My Tasks
          </h1>
          <p className="text-sm text-zinc-500">
            Manage your assigned tasks and workspace allocations.
          </p>
        </div>
      </div>

      {deleteMode && selectedTaskIds.length > 0 && (
        <div className="fixed top-4 left-1/2 z-[100] flex w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 items-center justify-between gap-4 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-white shadow-xl animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="flex items-center gap-2 text-sm font-medium">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500/20 text-xs font-semibold text-red-400">
              {selectedTaskIds.length}
            </span>
            <span>
              Delete {selectedTaskIds.length} task{selectedTaskIds.length === 1 ? "" : "s"}?
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={cancelDeleteMode}
              className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
              title="Cancel selection"
            >
              <X className="h-4 w-4" />
            </button>
            <Button
              size="sm"
              className="h-8 bg-red-600 px-3 text-xs font-medium text-white hover:bg-red-700"
              onClick={() => void handleBulkDelete()}
            >
              Confirm
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-col">
        <div className={`sticky top-0 z-30 border border-b-0 border-zinc-200 bg-white transition-[border-radius] duration-150 ${headingGone ? "rounded-none" : "rounded-t-lg"}`}>
          {headingGone && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute top-0 left-0 right-0 h-12 -translate-y-full"
              style={{
                background: "linear-gradient(to top, rgba(249,250,251,0.95) 0%, transparent 100%)",
              }}
            />
          )}
          <div className="flex items-center justify-between gap-4 rounded-t-lg border-b border-zinc-300 bg-zinc-200/80 px-4 py-3 overflow-hidden">
            <div className="flex-1">{tasksToolbar}</div>
          </div>

          <div className="flex items-center justify-between border-b border-zinc-300 bg-zinc-200/80 px-6 py-2">
            <p className="text-[12px] text-zinc-600">
              Showing{" "}
              <span className="font-medium text-zinc-600">{tasks.length}</span>
              {" "}of{" "}
              <span className="font-medium text-zinc-600">{totalCount}</span>
              {" "}tasks
            </p>
          </div>

          <div
            className={`hidden items-center gap-4 border-b border-zinc-200 bg-zinc-200/80 px-6 py-3 text-[13px] font-medium uppercase tracking-wider text-zinc-500 md:grid ${desktopTasksTableGrid}`}
          >
            <div
              onClick={() => handleSort("title")}
              className="flex cursor-pointer select-none items-center gap-1 hover:text-zinc-800"
            >
              Title {SortIcon("title")}
            </div>
            <div className="whitespace-nowrap">Workspace</div>
            <div className="whitespace-nowrap">Status</div>
            <div
              onClick={() => handleSort("start_date")}
              className="flex cursor-pointer select-none items-center gap-1 hover:text-zinc-800"
            >
              Start Date {SortIcon("start_date")}
            </div>
            <div
              onClick={() => handleSort("due_date")}
              className="flex cursor-pointer select-none items-center gap-1 hover:text-zinc-800"
            >
              Due Date {SortIcon("due_date")}
            </div>
            <div className="flex justify-center">
              <span className="sr-only">Actions</span>
            </div>
          </div>
        </div>

        {tasks.length === 0 && !initialLoading ? (
          <div className="flex flex-col items-center justify-center gap-4 rounded-b-xl border border-t-0 border-dashed border-zinc-200 bg-zinc-50/60 p-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-indigo-100 bg-indigo-50">
              <Calendar className="h-5 w-5 text-indigo-500" />
            </div>
            <div className="space-y-1">
              <h2 className="text-sm font-semibold text-zinc-900">No tasks found</h2>
              <p className="max-w-xs text-sm text-zinc-400">
                Create a task to organize work or clear your applied workspace filters.
              </p>
            </div>
            {canManage && (
              <Button
                onClick={() => setShowCreate(true)}
                className="h-9 border-transparent bg-indigo-500 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-600"
              >
                <Plus className="mr-2 h-4 w-4" />
                Create task
              </Button>
            )}
          </div>
        ) : null}
        
        <div className="w-full overflow-hidden rounded-b-xl border border-t-0 border-zinc-200 bg-white shadow-sm opacity-100 transition-opacity">
          <div className={`divide-y divide-zinc-100 ${initialLoading ? "opacity-40 pointer-events-none" : ""}`}>
            {tasks.map((task) => (
              <EmployeeTaskRow
                key={task.id}
                task={task}
                canManage={canManage}
                
                canEditStatus={canEditStatusForUser}
                deleteMode={deleteMode}
                selectedForDelete={selectedTaskIdSet.has(task.id)}
                projects={projects}
                savingId={savingId}
                onCommitUpdate={commitTaskUpdate}
                onProjectChange={handleProjectAssignment}
                onToggleDeleteSelection={toggleTaskSelection}
              />
            ))}
          </div>

          <div ref={sentinelRef} className="h-4 w-full bg-transparent" />

          {loadingMore && (
            <div className="flex items-center justify-center border-t border-zinc-100 bg-zinc-50/50 py-4 text-xs font-medium text-zinc-500">
              <span className="animate-pulse">Loading additional tasks...</span>
            </div>
          )}
        </div>
      </div>

      {showCreate && (
        <AppModal
          title="Add Task"
          description="Create a task and optionally attach it to a workspace right away."
          onClose={() => setShowCreate(false)}
          widthClassName="w-[380px]"
          footer={
            <>
              <Button
                variant="outline"
                onClick={() => setShowCreate(false)}
                disabled={creating}
                className="h-8 px-3 text-sm text-zinc-600"
              >
                Cancel
              </Button>
              <Button
                disabled={creating}
                onClick={() => void handleCreate()}
                className="h-8 bg-indigo-600 px-3 text-sm text-white hover:bg-indigo-700"
              >
                {creating ? "Creating..." : "Create"}
              </Button>
            </>
          }
        >
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-600">Task title</label>
            <input
              placeholder="Task title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 shadow-sm outline-none transition-[border-color,box-shadow] placeholder:text-zinc-400 hover:border-zinc-300 focus:border-transparent focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-600">Start date</label>
            <div className="relative">
              <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <DatePicker
              value={startDate || null}
              onChange={(value) => setStartDate(value ?? "")}
              placeholder="Start date"
              className="h-9 w-[150px] justify-start border-zinc-300 bg-white px-3 text-sm font-normal shadow-sm hover:bg-white"
            />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-600">Due date</label>
            <div className="relative">
              <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <DatePicker
              value={dueDate || null}
              onChange={(value) => setDueDate(value ?? "")}
              placeholder="Due date"
              className="h-9 w-[150px] justify-start border-zinc-300 bg-white px-3 text-sm font-normal shadow-sm hover:bg-white"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-600">Workspace</label>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="cursor-pointer h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 shadow-sm outline-none transition-[border-color,box-shadow] hover:border-zinc-300 focus:border-transparent focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">No workspace</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-600">Description</label>
            <textarea
              value={createDescription}
              onChange={(e) => setCreateDescription(e.target.value)}
              rows={2}
              placeholder="Add description"
              className="w-full resize-none rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 placeholder:text-zinc-400 outline-none transition-[border-color,box-shadow] focus:border-transparent focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </AppModal>
      )}
    </div>
  );
}