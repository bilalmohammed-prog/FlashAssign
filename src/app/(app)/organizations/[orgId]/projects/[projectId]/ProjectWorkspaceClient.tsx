"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Calendar,
  Plus,
  Search,
  Users,
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
import { listOrgMembers } from "@/actions/organization/listOrgMembers";
import { assignTaskToResource } from "@/actions/task/assign";
import { assignProjectMember } from "@/actions/project/assignProjectMember";
import { removeProjectMember } from "@/actions/project/removeProjectMember";
import { usePageHeader } from "@/components/layout/PageHeaderContext";
import { Button } from "@/components/ui/button";
import { AppModal } from "@/components/ui/app-modal";
import { Input } from "@/components/ui/input";
import { ExpandableDescription } from "@/components/tasks/ExpandableDescription";
import { TaskSelectionIndicator } from "@/components/tasks/TaskSelectionIndicator";
import { useToast } from "@/components/providers/toast";
import type { AppRole } from "@/lib/auth/permissions";
import { getWorkspaceCapabilities, canEditTask } from "@/lib/auth/ui-capabilities";
import { supabase } from "@/lib/supabase/client";

export type ProjectTaskRpc = {
  id: string;
  organization_id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: string;
  start_date: string | null;
  due_date: string | null;
  created_by: string;
  created_at: string;

  assignee_id: string | null;
  assignee_name: string | null;

  total_count: number;
};

type TaskPatch = {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  start_date?: string | null;
  due_date?: string | null;
  assignee_id?: string | null;
  assignee_name?: string | null;
};
type TaskStatus = Enums<"task_status">;
type HumanResource = { user_id: string; name: string; };

export type ProjectWorkspaceInitialData = {
  orgId: string;
  projectId: string;
  projectName: string;
  role: AppRole;
  userId: string;
  projectMembers: HumanResource[];
  tasks: ProjectTaskRpc[];
  initialAssigneeFilter?: string; // Add this
  initialStatusFilter?: string;   // Add this
};

const PAGE_SIZE = 10;
const desktopTasksTableGrid = "md:grid-cols-[48px_minmax(0,1.8fr)_220px_152px_140px_140px_48px]";

type TaskRowProps = {
  task: ProjectTaskRpc;
  canManage: boolean;
  canEditStatus: boolean;
  deleteMode: boolean;
  selectedForDelete: boolean;
  projectMembers: HumanResource[];
  savingId: string | null;
  onCommitUpdate: (taskId: string, updates: TablesUpdate<"tasks">) => void;
  onAssign: (taskId: string, resourceId: string) => void;
  onToggleDeleteSelection: (taskId: string) => void;
};

const TaskRow = memo(function TaskRow({
  task,
  canManage,
  canEditStatus,
  deleteMode,
  selectedForDelete,
  projectMembers,
  savingId,
  onCommitUpdate,
  onAssign,
  onToggleDeleteSelection,
}: TaskRowProps) {
  const [titleValue, setTitleValue] = useState(task.title);
  const [descriptionValue, setDescriptionValue] = useState(task.description ?? "");
  const [startDateValue, setStartDateValue] = useState(task.start_date ?? "");
  const [dueDateValue, setDueDateValue] = useState(task.due_date ?? "");
  
  const fieldsDisabled = !canManage || deleteMode;
  const statusDisabled = deleteMode || (!canManage && !canEditStatus);
  const rowClassName = selectedForDelete
    ? "border-red-200 bg-red-50/70 hover:bg-red-50/80"
    : "border-zinc-100 bg-white hover:bg-zinc-100/60";

  return (
    <div
      className={`group relative flex flex-col items-start gap-3 px-4 py-4 transition-colors md:grid md:items-center md:gap-4 md:px-6 md:py-3.5 ${desktopTasksTableGrid} ${rowClassName}`}
    >
      <div className="flex w-full justify-center pt-0.5 md:pt-0">
        <TaskSelectionIndicator
          selected={selectedForDelete || task.status === "done"}
          deleteMode={selectedForDelete}
        />
      </div>

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
          className={`w-full truncate bg-transparent text-[15px] font-medium outline-none disabled:cursor-default ${
            selectedForDelete
              ? "line-through text-red-950/80"
              : task.status === "done"
                ? "text-zinc-500"
                : "text-zinc-900"
          } ${selectedForDelete ? "opacity-90" : ""}`}
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
            className={`rounded px-2 py-0.5 text-xs font-medium ${getTaskStatusBadgeClass(task.status)} ${selectedForDelete ? "opacity-90" : ""}`}
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
          value={task.assignee_id || ""}
          onChange={(e) => onAssign(task.id, e.target.value)}
          disabled={fieldsDisabled}
          className={`min-w-0 flex-1 appearance-none bg-transparent text-sm font-medium text-zinc-900 outline-none disabled:cursor-default ${selectedForDelete ? "opacity-90" : ""}`}
        >
          <option value="">Unassigned</option>
          {projectMembers.map((employee) => (
            <option key={employee.user_id} value={employee.user_id}>
              {employee.name}
            </option>
          ))}
        </select>
        {!task.assignee_id && (
          <span className="pointer-events-none absolute right-4 flex items-center gap-1.5 text-sm font-medium italic text-zinc-400 md:relative md:right-auto">
            <AlertCircle className="h-4 w-4" />
          </span>
        )}
      </div>

      <div className="hidden md:flex md:flex-col md:items-start md:gap-2">
        <select
          value={task.status ?? "todo"}
          onChange={(e) => {
            const value = e.target.value as TaskStatus;
            onCommitUpdate(task.id, { status: value });
          }}
          disabled={statusDisabled}
          className={`appearance-none rounded-md border px-2.5 py-1 text-[13px] font-medium outline-none disabled:cursor-default cursor-pointer transition-all ${getTaskStatusBadgeClass(task.status)} ${selectedForDelete ? "opacity-90" : ""}`}
        >
          <option value="todo">To Do</option>
          <option value="in_progress">In Progress</option>
          <option value="blocked">Blocked</option>
          <option value="done">Completed</option>
        </select>
        {savingId === task.id && <span className="text-xs text-zinc-500">Saving...</span>}
      </div>

      <div className="hidden md:flex md:items-center md:gap-2">
        <input
          type="date"
          value={startDateValue}
          onChange={(e) => setStartDateValue(e.target.value)}
          onBlur={(e) => {
            if (e.target.value !== (task.start_date ?? "")) {
              onCommitUpdate(task.id, { start_date: e.target.value || null });
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === "Escape") e.currentTarget.blur();
          }}
          disabled={fieldsDisabled}
          className={`bg-transparent text-sm font-normal text-zinc-600 outline-none hover:text-zinc-900 disabled:cursor-default ${selectedForDelete ? "opacity-90" : ""}`}
        />
      </div>

      <div className="hidden md:flex md:items-center md:gap-2">
        <input
          type="date"
          value={dueDateValue}
          onChange={(e) => setDueDateValue(e.target.value)}
          onBlur={(e) => {
            if (e.target.value !== (task.due_date ?? "")) {
              onCommitUpdate(task.id, { due_date: e.target.value || null });
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === "Escape") e.currentTarget.blur();
          }}
          disabled={fieldsDisabled}
          className={`bg-transparent text-sm font-normal text-zinc-600 outline-none hover:text-zinc-900 disabled:cursor-default ${selectedForDelete ? "opacity-90" : ""}`}
        />
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
            <Trash2 className="h-4 w-4" />
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

export default function ProjectWorkspaceClient({ initialData }: { initialData: ProjectWorkspaceInitialData }) {
  const { addToast } = useToast();
  const { setPageHeader } = usePageHeader();
  
  const { orgId, projectId, projectName, role, userId } = initialData;
  const capabilities = getWorkspaceCapabilities(role);
  const canManage = capabilities.canManageTasks;

  const [projectMembers, setProjectMembers] = useState<HumanResource[]>(initialData.projectMembers);
  const [employees, setEmployees] = useState<HumanResource[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  
  // Pagination & Server State
  const [tasks, setTasks] = useState<ProjectTaskRpc[]>(initialData.tasks);
  const [totalCount, setTotalCount] = useState(initialData.tasks[0]?.total_count ?? 0);
  const [pageOffset, setPageOffset] = useState(0);
  const [hasMore, setHasMore] = useState(initialData.tasks.length < (initialData.tasks[0]?.total_count ?? 0));
  const [loadingMore, setLoadingMore] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);

  // Filter & Sort State
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | TaskStatus>(
  (initialData.initialStatusFilter as "all" | TaskStatus) || "all"
);
const [assigneeFilter, setAssigneeFilter] = useState<string>(
  initialData.initialAssigneeFilter || "all"
);
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
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
  
  const [showManageMembers, setShowManageMembers] = useState(false);
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [selectedMembersToAdd, setSelectedMembersToAdd] = useState<string[]>([]);
  const [selectedMembersToRemove, setSelectedMembersToRemove] = useState<string[]>([]);
  const [savingMembers, setSavingMembers] = useState(false);
  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const hasMoreRef = useRef(hasMore);
  const initialLoadingRef = useRef(initialLoading);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const orgMembersCacheRef = useRef<{ orgId: string; members: HumanResource[] } | null>(null);
  const loadingMoreRef = useRef(false);
  const addToastRef = useRef(addToast);
  const isFirstRender = useRef(true);

  useEffect(() => { addToastRef.current = addToast; }, [addToast]);

// Fix: initialize to actual loaded count
const offsetRef = useRef(initialData.tasks.length);
  // Core API Fetching Method mapped to RPC
  const fetchTasks = useCallback(async (offset: number, append = false) => {
  if (append && loadingMoreRef.current) return;

    loadingMoreRef.current = true;
    setLoadingMore(true);

  if (!append) {
    initialLoadingRef.current = true;
    setInitialLoading(true);
    offsetRef.current = 0;
  } else {
    loadingMoreRef.current = true;
    setLoadingMore(true);
  }

  try {
    
    const { data, error } = await supabase.rpc("list_project_tasks_with_meta", {
      org_uuid: orgId,
      project_uuid: projectId,
      page_size: PAGE_SIZE,
      page_offset: offset,
      search_query: searchQuery || undefined,
      status_filter: statusFilter !== "all" ? statusFilter : undefined,
      assignee_filter: assigneeFilter !== "all" && assigneeFilter !== "unassigned" ? assigneeFilter : undefined,
      unassigned_only: assigneeFilter === "unassigned",
      start_date_from: startDateFilter || undefined,
      due_date_to: dueDateFilter || undefined,
      sort_by: sortBy,
      sort_order: sortOrder,
    });
    if (data) {
  console.log({
    requested: {
      page_size: PAGE_SIZE,
      page_offset: offset,
    },
    returned: data.length,
    total: data[0]?.total_count,
  });
}
console.table(
  (data ?? []).map((t, i) => ({
    i,
    id: t.id,
    title: t.title,
  }))
);
console.log({
  page_size: PAGE_SIZE,
  page_offset: offset,
});
console.log("RPC returned", {
  error,
  rows: data?.length,
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
    addToastRef.current("Failed to load workspace tasks", "error");
  } finally {
    initialLoadingRef.current = false;
    setInitialLoading(false);
    setLoadingMore(false);
    loadingMoreRef.current = false;
  }
// addToast removed — use addToastRef.current inside instead
}, [orgId, projectId, searchQuery, statusFilter, assigneeFilter, startDateFilter, dueDateFilter, sortBy, sortOrder]);

  // Handle updates to server queries across filters
  useEffect(() => {
  if (isFirstRender.current) {
    isFirstRender.current = false;
    return; // trust SSR data on mount
  }
  offsetRef.current = 0;
  void fetchTasks(0, false);
}, [fetchTasks]);

  // Infinite Scroll IntersectionObserver hook
  useEffect(() => {
  const sentinel = sentinelRef.current;
  // Effect won't even run while loading — no observer created
  if (!sentinel || !hasMore || loadingMore || initialLoading) return;

  const observer = new IntersectionObserver(
    (entries) => {
      const entry = entries[0];
        console.log("observer", {
    isIntersecting: entry.isIntersecting,
    offset: offsetRef.current,
    hasMore: hasMoreRef.current,
    loading: loadingMoreRef.current,
  });
      if (!entry.isIntersecting) return;

observer.unobserve(entry.target);

void fetchTasks(offsetRef.current, true);
    },
    { rootMargin: "200px" }
  );

  observer.observe(sentinel);
  return () => observer.disconnect();
  
}, [hasMore, loadingMore, initialLoading, fetchTasks]);

  const fetchOrgMembers = useCallback(async () => {
    if (orgMembersCacheRef.current?.orgId === orgId) {
      setEmployees(orgMembersCacheRef.current.members);
      return;
    }
    setMembersLoading(true);
    try {
      const humansResult = await listOrgMembers(orgId);
      if (!humansResult.error && humansResult.data) {
        const mapped = humansResult.data.map((human) => ({
          user_id: human.user_id,
          name: human.name,
        }));
        orgMembersCacheRef.current = { orgId, members: mapped };
        setEmployees(mapped);
      } else {
        setEmployees([]);
      }
    } catch {
      setEmployees([]);
    } finally {
      setMembersLoading(false);
    }
  }, [orgId]);

  const availableEmployees = useMemo(
    () => employees.filter((employee) => !projectMembers.some((member) => member.user_id === employee.user_id)),
    [employees, projectMembers]
  );

  const filteredAvailableEmployees = useMemo(
    () => availableEmployees.filter((employee) => employee.name.toLowerCase().includes(memberSearch.toLowerCase())),
    [availableEmployees, memberSearch]
  );

  const filteredProjectMembers = useMemo(
    () => projectMembers.filter((member) => member.name.toLowerCase().includes(memberSearch.toLowerCase())),
    [memberSearch, projectMembers]
  );

  useEffect(() => {
    if (showAddMembers) {
      void fetchOrgMembers();
    }
  }, [fetchOrgMembers, showAddMembers]);

  const selectedTaskIdSet = useMemo(() => new Set(selectedTaskIds), [selectedTaskIds]);

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
      const task = tasks.find((entry) => entry.id === id);
      
      const scopedUpdates = canManage
        ? updates
        : canEditTask(role, { userId, assigneeId: task?.assignee_id ?? null }) && updates.status !== undefined
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
    [canManage, commitUpdate, role, tasks, updateTaskInState, userId]
  );

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
    if (!title.trim()) return;

    try {
      setCreating(true);
      const created = await createTask(title.trim(), createDescription.trim() || undefined, startDate, dueDate, orgId, projectId);
      
      const optionalUpdates: TablesUpdate<"tasks"> = {};
      if (startDate) {
        optionalUpdates.start_date = startDate;
      }

      if (Object.keys(optionalUpdates).length > 0) {
        await updateTask(created.id, optionalUpdates, orgId);
      }

      const newTask: ProjectTaskRpc = {
        id: created.id,
        organization_id: orgId,
        project_id: projectId,
        title: created.title,
        description: created.description ?? null,
        status: "todo",
        start_date: startDate || null,
        due_date: dueDate || null,
        created_by: userId,
        created_at: new Date().toISOString(),
        assignee_id: null,
        assignee_name: null,
        total_count: totalCount + 1,
      };

      if (selectedEmployee) {
        await assignTaskToResource(created.id, selectedEmployee);
        newTask.assignee_id = selectedEmployee;
        newTask.assignee_name = projectMembers.find((employee) => employee.user_id === selectedEmployee)?.name ?? null;
      }

      setTasks((prev) => [newTask, ...prev]);
      setTotalCount((prev) => prev + 1);
      setTitle("");
      setCreateDescription("");
      setStartDate("");
      setDueDate("");
      setSelectedEmployee("");
      setShowCreate(false);
      addToast("Task created", "success");
    } catch {
      addToast("Failed to create task", "error");
    } finally {
      setCreating(false);
    }
  }

  const handleTaskAssignment = useCallback(
    async (taskId: string, resourceId: string) => {
      try {
        await assignTaskToResource(taskId, resourceId || null);
        const employee = projectMembers.find((member) => member.user_id === resourceId);
        updateTaskInState(taskId, {
          assignee_id: resourceId || null,
          assignee_name: resourceId ? employee?.name ?? null : null,
        });
      } catch {
        addToast("Failed to update assignee", "error");
      }
    },
    [addToast, projectMembers, updateTaskInState]
  );

  async function handleAddMembers() {
    if (selectedMembersToAdd.length === 0) return;
    try {
      setSavingMembers(true);
      await Promise.all(selectedMembersToAdd.map((userId) => assignProjectMember(projectId, userId, orgId)));
      const nextMembers = employees.filter((employee) => selectedMembersToAdd.includes(employee.user_id));
      setProjectMembers((prev) => [
        ...prev,
        ...nextMembers.filter((employee) => !prev.some((member) => member.user_id === employee.user_id)),
      ]);
      setSelectedMembersToAdd([]);
      setMemberSearch("");
      setShowAddMembers(false);
      addToast("Members added to project", "success");
    } catch {
      addToast("Failed to add members", "error");
    } finally {
      setSavingMembers(false);
    }
  }

  async function handleRemoveMembers() {
    if (selectedMembersToRemove.length === 0) return;
    try {
      setSavingMembers(true);
      await Promise.all(selectedMembersToRemove.map((userId) => removeProjectMember(projectId, userId)));
      setProjectMembers((prev) => prev.filter((member) => !selectedMembersToRemove.includes(member.user_id)));
      setSelectedMembersToRemove([]);
      setMemberSearch("");
      setShowManageMembers(false);
      addToast("Members removed from project", "success");
    } catch {
      addToast("Failed to remove members", "error");
    } finally {
      setSavingMembers(false);
    }
  }

  useEffect(() => {
    setPageHeader(
      <div className="flex w-full flex-wrap items-center justify-between gap-3 md:flex-nowrap">
        <div className="min-w-0 flex-1 md:max-w-[min(52%,640px)]">
          <h1 className="truncate text-xl font-semibold tracking-tight text-zinc-900 md:text-[22px]" title={projectName}>
            {projectName}
          </h1>
          <p className="text-xs text-zinc-500">
            Manage project tasks and workspace members
          </p>
        </div>

        {canManage && (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 md:flex-nowrap">
            <Button
              variant="outline"
              className="h-8 border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50"
              onClick={() => {
                setMemberSearch("");
                setSelectedMembersToAdd([]);
                setShowAddMembers(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4 text-zinc-500" />
              Add Member
            </Button>
            <Button
              variant="outline"
              className="h-8 border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50"
              onClick={() => {
                setMemberSearch("");
                setSelectedMembersToRemove([]);
                setShowManageMembers(true);
              }}
            >
              <Users className="mr-2 h-4 w-4 text-zinc-500" />
              Manage Members
            </Button>
          </div>
        )}
      </div>
    );

    return () => {
      setPageHeader(null);
    };
  }, [canManage, projectName, setPageHeader]);

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

        <select
          value={assigneeFilter}
          onChange={(e) => setAssigneeFilter(e.target.value)}
          className="h-9 w-full cursor-pointer rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-700 shadow-sm outline-none transition-colors focus:border-transparent focus:ring-2 focus:ring-indigo-500 sm:w-44"
        >
          <option value="all">Any assignee</option>
          <option value="unassigned">Unassigned</option>
          {projectMembers.map((m) => (
            <option key={m.user_id} value={m.user_id}>{m.name}</option>
          ))}
        </select>

        <div className="flex items-center gap-2">
          <input
            type="date"
            value={startDateFilter}
            onChange={(e) => setStartDateFilter(e.target.value)}
            className="h-9 w-[140px] cursor-pointer rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-700 shadow-sm outline-none transition-colors focus:border-transparent focus:ring-2 focus:ring-indigo-500"
          />
          <input
            type="date"
            value={dueDateFilter}
            onChange={(e) => setDueDateFilter(e.target.value)}
            className="h-9 w-[140px] cursor-pointer rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-700 shadow-sm outline-none transition-colors focus:border-transparent focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {canManage && (
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 md:flex-nowrap">
          <Button
            className="h-9 shrink-0 cursor-pointer rounded-lg border border-indigo-500 bg-indigo-500 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-500/90"
            onClick={() => setShowCreate(true)}
          >
            <Plus className="mr-2 h-4 w-4 opacity-90" />
            Add Task
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex w-full flex-col gap-4 pb-12">
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
        <div className="sticky top-0 z-30 border border-b-0 border-zinc-200 bg-white transition-[border-radius] duration-150 rounded-t-lg">
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
            <div className="flex justify-center">
              <span className="sr-only">Select Task</span>
            </div>
            <div
              onClick={() => handleSort("title")}
              className="flex cursor-pointer select-none items-center gap-1 hover:text-zinc-800"
            >
              Title {SortIcon("title")}
            </div>
            <div className="whitespace-nowrap">Assignee</div>
            <div
              onClick={() => handleSort("status")}
              className="flex cursor-pointer select-none items-center gap-1 hover:text-zinc-800"
            >
              Status {SortIcon("status")}
            </div>
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
              <TaskRow
                key={task.id}
                task={task}
                canManage={canManage}
                canEditStatus={canEditTask(role, {
                  userId,
                  assigneeId: task.assignee_id,
                })}
                deleteMode={deleteMode}
                selectedForDelete={selectedTaskIdSet.has(task.id)}
                projectMembers={projectMembers}
                savingId={savingId}
                onCommitUpdate={commitTaskUpdate}
                onAssign={handleTaskAssignment}
                onToggleDeleteSelection={toggleTaskSelection}
              />
            ))}
          </div>

          {/* Sentinel Element for Intersection Observer */}
          <div ref={sentinelRef} className="h-4 w-full bg-transparent" />

          {/* Loading Indicator for Lazy Pages */}
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
          description="Create a task and optionally assign it right away."
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
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-9 w-full rounded-md border border-zinc-200 bg-white pl-9 pr-3 text-sm text-zinc-900 shadow-sm outline-none transition-[border-color,box-shadow] hover:border-zinc-300 focus:border-transparent focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-600">Due date</label>
            <div className="relative">
              <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="h-9 w-full rounded-md border border-zinc-200 bg-white pl-9 pr-3 text-sm text-zinc-900 shadow-sm outline-none transition-[border-color,box-shadow] hover:border-zinc-300 focus:border-transparent focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-600">Assignee</label>
            <select
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
              className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 shadow-sm outline-none transition-[border-color,box-shadow] hover:border-zinc-300 focus:border-transparent focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Unassigned</option>
              {projectMembers.map((employee) => (
                <option key={employee.user_id} value={employee.user_id}>
                  {employee.name}
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

      {showAddMembers && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-[440px] space-y-4 rounded-xl border border-zinc-200 bg-white p-6 text-zinc-900 shadow-sm">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900">Add Members</h2>
              <p className="mt-1 text-sm text-zinc-500">Add one or more organization members to this project.</p>
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <Input
                placeholder="Search members"
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="max-h-72 overflow-auto rounded-lg border border-zinc-100 bg-zinc-50/40">
              {membersLoading ? (
                <div className="px-4 py-6 text-sm text-zinc-500">Loading members...</div>
              ) : filteredAvailableEmployees.length === 0 ? (
                <div className="px-4 py-6 text-sm text-zinc-500">No available members found.</div>
              ) : (
                filteredAvailableEmployees.map((employee) => (
                  <label
                    key={employee.user_id}
                    className="flex items-center gap-3 border-b border-zinc-100 px-4 py-3 last:border-b-0"
                  >
                    <input
                      type="checkbox"
                      checked={selectedMembersToAdd.includes(employee.user_id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedMembersToAdd((prev) => [...prev, employee.user_id]);
                        } else {
                          setSelectedMembersToAdd((prev) => prev.filter((id) => id !== employee.user_id));
                        }
                      }}
                    />
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
                      {employee.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-zinc-900">{employee.name}</div>
                      <div className="text-xs text-zinc-500">Organization member</div>
                    </div>
                  </label>
                ))
              )}
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowAddMembers(false);
                  setSelectedMembersToAdd([]);
                  setMemberSearch("");
                }}
                className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 transition-colors hover:bg-zinc-50"
              >
                Cancel
              </button>

              <button
                disabled={selectedMembersToAdd.length === 0 || savingMembers}
                onClick={() => void handleAddMembers()}
                className="rounded-md border border-transparent bg-indigo-600 px-3 py-1.5 text-sm text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:opacity-40"
              >
                {savingMembers
                  ? "Adding..."
                  : `Add ${selectedMembersToAdd.length || ""} ${selectedMembersToAdd.length === 1 ? "Member" : "Members"}`.trim()}
              </button>
            </div>
          </div>
        </div>
      )}

      {showManageMembers && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-[460px] space-y-4 rounded-xl border border-zinc-200 bg-white p-6 text-zinc-900 shadow-sm">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900">Manage Members</h2>
              <p className="mt-1 text-sm text-zinc-500">Select project members to remove from this workspace.</p>
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <Input
                placeholder="Search project members"
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="max-h-72 overflow-auto rounded-lg border border-zinc-100 bg-zinc-50/40">
              {filteredProjectMembers.length === 0 ? (
                <div className="px-4 py-6 text-sm text-zinc-500">No project members found.</div>
              ) : (
                filteredProjectMembers.map((member) => (
                  <label key={member.user_id} className="flex items-center gap-3 border-b border-zinc-100 px-4 py-3 last:border-b-0">
                    <input
                      type="checkbox"
                      checked={selectedMembersToRemove.includes(member.user_id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedMembersToRemove((prev) => [...prev, member.user_id]);
                        } else {
                          setSelectedMembersToRemove((prev) => prev.filter((id) => id !== member.user_id));
                        }
                      }}
                    />
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
                      {member.name.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-zinc-900">{member.name}</div>
                      <div className="text-xs text-zinc-500">Project member</div>
                    </div>
                  </label>
                ))
              )}
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowManageMembers(false);
                  setSelectedMembersToRemove([]);
                  setMemberSearch("");
                }}
                className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 transition-colors hover:bg-zinc-50"
              >
                Cancel
              </button>

              <button
                disabled={selectedMembersToRemove.length === 0 || savingMembers}
                onClick={() => void handleRemoveMembers()}
                className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-100 disabled:opacity-40"
              >
                {savingMembers ? "Removing..." : `Remove Selected${selectedMembersToRemove.length ? ` (${selectedMembersToRemove.length})` : ""}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
