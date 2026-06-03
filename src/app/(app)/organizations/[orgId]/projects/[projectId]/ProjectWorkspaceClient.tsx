"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Calendar, Plus, Search, Users } from "lucide-react";
import type { Enums, Tables, TablesUpdate } from "@/lib/types/database";
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

type TaskWithAssignee = Tables<"tasks"> & {
  assignee_id: string | null;
  assignee_name: string | null;
};

type TaskPatch = Partial<TaskWithAssignee>;

type TaskStatus = Enums<"task_status">;

type HumanResource = {
  user_id: string;
  name: string;
};

export type ProjectWorkspaceInitialData = {
  orgId: string;
  projectId: string;
  projectName: string;
  role: AppRole;
  userId: string;
  projectMembers: HumanResource[];
  tasks: TaskWithAssignee[];
};

type TaskRowProps = {
  task: TaskWithAssignee;
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
  const [dueDateValue, setDueDateValue] = useState(task.due_date ?? "");

  const fieldsDisabled = !canManage || deleteMode;
  const statusDisabled = deleteMode || (!canManage && !canEditStatus);
  const rowClassName = deleteMode
    ? selectedForDelete
      ? "cursor-pointer border-red-200 bg-red-50/70 hover:bg-red-50/80"
      : "cursor-pointer border-zinc-100 bg-white hover:border-red-200 hover:bg-red-50/30"
    : "border-zinc-100 bg-white hover:bg-zinc-50/50";

  return (
    <div
      role={deleteMode ? "button" : undefined}
      tabIndex={deleteMode ? 0 : undefined}
      aria-selected={deleteMode ? selectedForDelete : undefined}
      onClick={deleteMode ? () => onToggleDeleteSelection(task.id) : undefined}
      onKeyDown={
        deleteMode
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onToggleDeleteSelection(task.id);
              }
            }
          : undefined
      }
      className={`group flex flex-col items-start gap-2.5 border-t px-4 py-3.5 transition-colors first:border-t-0 md:grid md:grid-cols-[48px_minmax(0,1.8fr)_220px_152px_132px] md:items-center md:gap-4 md:py-3 ${rowClassName}`}
    >
      <div className="flex w-full justify-center pt-0.5 md:pt-0">
        <TaskSelectionIndicator
          selected={deleteMode ? selectedForDelete : task.status === "done"}
          deleteMode={deleteMode}
        />
      </div>

      <div className="flex w-full min-w-0 flex-col">
        <input
          value={titleValue}
          onChange={(e) => setTitleValue(e.target.value)}
          onBlur={(e) => {
            onCommitUpdate(task.id, { title: e.target.value });
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          disabled={fieldsDisabled}
          className={`w-full truncate bg-transparent text-[15px] font-medium outline-none disabled:cursor-default ${
            deleteMode && selectedForDelete
              ? "line-through text-red-950/80"
              : task.status === "done"
                ? "text-zinc-500"
                : "text-zinc-900"
          } ${deleteMode ? "opacity-90" : ""}`}
        />
        <ExpandableDescription
          value={descriptionValue}
          onChange={(nextValue) => setDescriptionValue(nextValue)}
          onCommit={(nextValue) => {
            onCommitUpdate(task.id, { description: nextValue.trim() ? nextValue : null });
          }}
          disabled={fieldsDisabled}
          className={`mt-1 ${deleteMode ? "opacity-90" : ""}`}
        />
        <div className="mt-1.5 flex items-center gap-3 text-xs text-zinc-500 md:hidden">
          <span
            className={`rounded px-2 py-0.5 text-xs font-medium ${getTaskStatusBadgeClass(task.status)} ${deleteMode ? "opacity-90" : ""}`}
          >
            {getTaskStatusLabel(task.status)}
          </span>
          <span className={deleteMode ? "opacity-90" : ""}>{formatDueDate(task.due_date)}</span>
          {savingId === task.id && <span>Saving...</span>}
        </div>
      </div>

      <div className="flex w-full items-center gap-2.5">
        {task.assignee_name ? (
          <select
            value={task.assignee_id || ""}
            onChange={(e) => onAssign(task.id, e.target.value)}
            disabled={fieldsDisabled}
            className={`min-w-0 flex-1 appearance-none bg-transparent text-sm font-medium text-zinc-900 outline-none disabled:cursor-default ${deleteMode ? "opacity-90" : ""}`}
          >
            <option value="">Unassigned</option>
            {projectMembers.map((employee) => (
              <option key={employee.user_id} value={employee.user_id}>
                {employee.name}
              </option>
            ))}
          </select>
        ) : (
          <div className="flex w-full items-center gap-2.5">
            <span className="flex items-center gap-1.5 text-sm font-medium italic text-zinc-400">
              <AlertCircle className="h-4 w-4" />
              Unassigned
            </span>
            <select
              value={task.assignee_id || ""}
              onChange={(e) => onAssign(task.id, e.target.value)}
              disabled={fieldsDisabled}
              className={`min-w-0 flex-1 appearance-none bg-transparent text-sm text-zinc-500 outline-none disabled:cursor-default ${deleteMode ? "opacity-90" : ""}`}
            >
              <option value="">Unassigned</option>
              {projectMembers.map((employee) => (
                <option key={employee.user_id} value={employee.user_id}>
                  {employee.name}
                </option>
              ))}
            </select>
          </div>
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
          className={`appearance-none rounded-md border px-2.5 py-1 text-[13px] font-medium outline-none disabled:cursor-default ${getTaskStatusBadgeClass(task.status)} ${deleteMode ? "opacity-90" : ""}`}
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
          value={dueDateValue}
          onChange={(e) => setDueDateValue(e.target.value)}
          onBlur={(e) => {
            onCommitUpdate(task.id, { due_date: e.target.value || null });
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === "Escape") e.currentTarget.blur();
          }}
          disabled={fieldsDisabled}
          className={`bg-transparent text-sm font-medium text-zinc-600 outline-none disabled:cursor-default ${deleteMode ? "opacity-90" : ""}`}
        />
      </div>
    </div>
  );
});

function formatDueDate(value: string | null) {
  if (!value) return "No due date";
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function getTaskStatusLabel(status: TaskStatus | null) {
  if (status === "in_progress") return "In Progress";
  if (status === "done") return "Completed";
  if (status === "blocked") return "Blocked";
  return "To Do";
}

function getTaskStatusBadgeClass(status: TaskStatus | null) {
  if (status === "done") return "bg-emerald-50 text-emerald-700 border-emerald-200/60";
  if (status === "in_progress") return "bg-indigo-50 text-indigo-700 border-indigo-200/60";
  if (status === "blocked") return "bg-amber-50 text-amber-700 border-amber-200/60";
  return "bg-zinc-100 text-zinc-700 border-zinc-200/60";
}

export default function ProjectWorkspaceClient({ initialData }: { initialData: ProjectWorkspaceInitialData }) {
  const { addToast } = useToast();
  const { setPageHeader } = usePageHeader();

  const orgId = initialData.orgId;
  const projectId = initialData.projectId;
  const projectName = initialData.projectName;
  const role = initialData.role;
  const userId = initialData.userId;
  const capabilities = getWorkspaceCapabilities(role);
  const canManage = capabilities.canManageTasks;

  const [projectMembers, setProjectMembers] = useState<HumanResource[]>(initialData.projectMembers);
  const [employees, setEmployees] = useState<HumanResource[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<TaskWithAssignee[]>(initialData.tasks);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [createDescription, setCreateDescription] = useState("");
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

  const orgMembersCacheRef = useRef<{ orgId: string; members: HumanResource[] } | null>(null);
  const renderCountRef = useRef(0);

  useEffect(() => {
    renderCountRef.current += 1;
    if (renderCountRef.current > 1) {
      console.info(
        `[render] project workspace #${renderCountRef.current} tasks=${tasks.length} members=${projectMembers.length} loading=${showCreate ? "create" : "idle"} deleteMode=${deleteMode}`
      );
    }
  }, [deleteMode, projectMembers.length, showCreate, tasks.length]);

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

  const updateTaskInState = useCallback((id: string, updates: TaskPatch) => {
    setTasks((prev) => prev.map((task) => (task.id === id ? { ...task, ...updates } : task)));
  }, []);

  const commitUpdate = useCallback(
    async (id: string, updates: TablesUpdate<"tasks">) => {
      try {
        setSavingId(id);
        await updateTask(id, updates, orgId);
      } catch (error) {
        console.error("Save failed", error);
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

      if (!scopedUpdates) {
        return;
      }

      updateTaskInState(id, scopedUpdates);
      void commitUpdate(id, scopedUpdates);
    },
    [canManage, commitUpdate, role, tasks, updateTaskInState, userId]
  );

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
    if (selectedTaskIds.length === 0) {
      return;
    }

    const taskIdsToDelete = [...selectedTaskIds];
    const backupTasks = tasks;

    setTasks((prev) => prev.filter((task) => !taskIdsToDelete.includes(task.id)));
    setDeleteMode(false);
    setSelectedTaskIds([]);

    try {
      await Promise.all(taskIdsToDelete.map((taskId) => deleteTaskAction(taskId, orgId)));
      addToast(`Deleted ${taskIdsToDelete.length} task${taskIdsToDelete.length === 1 ? "" : "s"}`, "success");
    } catch {
      setTasks(backupTasks);
      setDeleteMode(true);
      setSelectedTaskIds(taskIdsToDelete);
      addToast("Failed to delete selected tasks", "error");
    }
  }, [addToast, orgId, selectedTaskIds, tasks]);

  async function handleCreate() {
    if (!title.trim() || !dueDate) return;

    try {
      setCreating(true);

      const created = await createTask(
        title.trim(),
        createDescription.trim() || undefined,
        dueDate,
        orgId,
        projectId
      );
      const newTask: TaskWithAssignee = {
        ...created,
        assignee_id: null,
        assignee_name: null,
      };

      if (selectedEmployee) {
        await assignTaskToResource(created.id, selectedEmployee);
        newTask.assignee_id = selectedEmployee;
        newTask.assignee_name = projectMembers.find((employee) => employee.user_id === selectedEmployee)?.name ?? null;
      }

      setTasks((prev) => [newTask, ...prev]);
      setTitle("");
      setCreateDescription("");
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
          assignee_name: employee?.name ?? null,
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
            {deleteMode ? `${selectedTaskIds.length} selected for deletion` : "Tasks and members in this project"}
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
  }, [canManage, cancelDeleteMode, deleteMode, handleBulkDelete, projectName, selectedTaskIds.length, setPageHeader, tasks.length, toggleDeleteMode]);

  return (
    <div className="flex w-full max-w-5xl flex-col pb-10">
      <section>
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
          <div className="hidden grid-cols-[48px_minmax(0,1.8fr)_220px_152px_132px] items-center gap-4 border-b border-zinc-200/80 bg-zinc-50/80 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-zinc-500 md:grid">
            <div className="flex justify-center">
              <span className="sr-only">Select Task</span>
            </div>
            <div>Title</div>
            <div>Assignee</div>
            <div>Status</div>
            <div>Due Date</div>
          </div>

          <div className="flex flex-col">
            {tasks.map((task) => (
              <TaskRow
                key={`${task.id}-${task.title}-${task.description ?? ""}-${task.due_date ?? ""}`}
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
        </div>
      </section>

      {showCreate && (
        <AppModal
          title="Add Task"
          description="Create a task and optionally assign it right away."
          onClose={() => {
            setShowCreate(false);
          }}
          widthClassName="w-[380px]"
          footer={
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreate(false);
                }}
                disabled={creating}
                className="h-8 px-3 text-sm text-zinc-600"
              >
                Cancel
              </Button>
              <Button
                disabled={creating}
                onClick={() => {
                  void handleCreate();
                }}
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
                onClick={() => {
                  void handleAddMembers();
                }}
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
                onClick={() => {
                  void handleRemoveMembers();
                }}
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
