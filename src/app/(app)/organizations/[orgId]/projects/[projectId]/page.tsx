"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { AlertCircle, Calendar, CheckSquare, Plus, Search, Square, Users } from "lucide-react";
import { listTasksByProject } from "@/actions/task/listByProject";
import { updateTask } from "@/actions/task/update";
import { createTask } from "@/actions/task/create";
import { deleteTask as deleteTaskAction } from "@/actions/task/delete";
import type { Enums, Tables, TablesUpdate } from "@/lib/types/database";
import { listOrgMembers } from "@/actions/organization/listOrgMembers";
import { assignTaskToResource } from "@/actions/task/assign";
import { listProjectMembers } from "@/actions/project/listProjectMembers";
import { assignProjectMember } from "@/actions/project/assignProjectMember";
import { removeProjectMember } from "@/actions/project/removeProjectMember";
import { useOrgRole } from "@/hooks/useOrgRole";
import { usePageHeader } from "@/components/layout/PageHeaderContext";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { AppModal } from "@/components/ui/app-modal";
import { Input } from "@/components/ui/input";
import { ExpandableDescription } from "@/components/tasks/ExpandableDescription";
import { useToast } from "@/components/providers/toast";

type TaskWithAssignee = Tables<"tasks"> & {
  assignee_id: string | null;
  assignee_name: string | null;
};

type TaskStatus = Enums<"task_status">;

type HumanResource = {
  user_id: string;
  name: string;
};

type ProjectRecord = Pick<Tables<"projects">, "id" | "name">;

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

export default function ProjectWorkspacePage() {
  const role = useOrgRole();
  const canManage = role === "owner" || role === "admin" || role === "manager";
  const { addToast } = useToast();
  const { setPageHeader } = usePageHeader();
  const { orgId, projectId } = useParams<{ orgId: string; projectId: string }>();

  const [projectMembers, setProjectMembers] = useState<HumanResource[]>([]);
  const [employees, setEmployees] = useState<HumanResource[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<TaskWithAssignee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
  const [projectName, setProjectName] = useState("Project");
  const [showManageMembers, setShowManageMembers] = useState(false);
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [selectedMembersToAdd, setSelectedMembersToAdd] = useState<string[]>([]);
  const [selectedMembersToRemove, setSelectedMembersToRemove] = useState<string[]>([]);
  const [savingMembers, setSavingMembers] = useState(false);

  useEffect(() => {
    async function load() {
      setProjectMembers([]);

      const humansResult = await listOrgMembers(orgId);
      if (!humansResult.error && humansResult.data) {
        setEmployees(
          humansResult.data.map((human) => ({
            user_id: human.user_id,
            name: human.name,
          }))
        );
      } else {
        setEmployees([]);
      }

      const { data: projectData } = await supabase
        .from("projects")
        .select("id, name")
        .eq("id", projectId)
        .eq("organization_id", orgId)
        .maybeSingle<ProjectRecord>();

      if (projectData?.name) {
        setProjectName(projectData.name);
      }

      const members = await listProjectMembers(projectId);
      setProjectMembers(members);

      setLoading(true);
      const data = await listTasksByProject(projectId, orgId);
      setTasks(data);
      setLoading(false);
    }

    if (projectId && orgId) {
      void load();
    }
  }, [projectId, orgId]);

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

  function updateLocal(id: string, updates: TablesUpdate<"tasks">) {
    setTasks((prev) => prev.map((task) => (task.id === id ? { ...task, ...updates } : task)));
  }

  async function commitUpdate(id: string, updates: TablesUpdate<"tasks">) {
    try {
      setSavingId(id);
      await updateTask(id, updates, orgId);
    } catch (error) {
      console.error("Save failed", error);
      addToast("Failed to save task", "error");
    } finally {
      setSavingId(null);
    }
  }

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
        newTask.assignee_name = employees.find((employee) => employee.user_id === selectedEmployee)?.name ?? null;
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

  async function handleDelete(id: string) {
    const backup = tasks;
    setTasks((prev) => prev.filter((task) => task.id !== id));

    try {
      await deleteTaskAction(id, orgId);
      addToast("Task deleted", "success");
    } catch {
      setTasks(backup);
      addToast("Failed to delete task", "error");
    }
  }

  async function handleTaskAssignment(taskId: string, resourceId: string) {
    try {
      await assignTaskToResource(taskId, resourceId || null);
      const employee = projectMembers.find((member) => member.user_id === resourceId);

      setTasks((prev) =>
        prev.map((task) =>
          task.id === taskId
            ? {
                ...task,
                assignee_id: resourceId || null,
                assignee_name: employee?.name ?? null,
              }
            : task
        )
      );
    } catch {
      addToast("Failed to update assignee", "error");
    }
  }

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
      <div className="flex w-full flex-wrap items-center justify-between gap-2 md:flex-nowrap">
        <div className="min-w-0 flex-1 md:max-w-[min(52%,640px)]">
          <h1 className="truncate text-xl font-semibold tracking-tight text-zinc-900 md:text-[22px]" title={projectName}>
            {projectName}
          </h1>
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
          </div>
        )}
      </div>
    );

    return () => {
      setPageHeader(null);
    };
  }, [canManage, projectName, setPageHeader]);

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
            {loading ? (
              <div className="px-4 py-4 text-sm text-zinc-500">Loading...</div>
            ) : (
              tasks.map((task) => (
                <div
                  key={task.id}
                  className="group flex flex-col items-start gap-2.5 border-t border-zinc-100 px-4 py-3.5 transition-colors hover:bg-zinc-50/50 first:border-t-0 md:grid md:grid-cols-[48px_minmax(0,1.8fr)_220px_152px_132px] md:items-center md:gap-4 md:py-3"
                >
                  <div className="hidden cursor-pointer justify-center text-zinc-300 transition-colors group-hover:text-indigo-500 md:flex">
                    {task.status === "done" ? (
                      <CheckSquare className="h-5 w-5 text-indigo-600" />
                    ) : (
                      <Square className="h-5 w-5" />
                    )}
                  </div>

                  <div className="flex w-full min-w-0 flex-col">
                    <input
                      value={task.title}
                      onChange={(e) => updateLocal(task.id, { title: e.target.value })}
                      onBlur={(e) => {
                        void commitUpdate(task.id, { title: e.target.value });
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.currentTarget.blur();
                      }}
                      className={`w-full truncate bg-transparent text-[15px] font-medium outline-none ${task.status === "done" ? "text-zinc-500" : "text-zinc-900"}`}
                    />
                    <ExpandableDescription
                      value={task.description ?? ""}
                      onChange={(nextValue) => updateLocal(task.id, { description: nextValue })}
                      onCommit={(nextValue) => {
                        void commitUpdate(task.id, { description: nextValue.trim() ? nextValue : null });
                      }}
                      disabled={!canManage}
                      className="mt-1"
                    />
                    <div className="mt-1.5 flex items-center gap-3 text-xs text-zinc-500 md:hidden">
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${getTaskStatusBadgeClass(task.status)}`}>
                        {getTaskStatusLabel(task.status)}
                      </span>
                      <span>{formatDueDate(task.due_date)}</span>
                      {savingId === task.id && <span>Saving...</span>}
                    </div>
                  </div>

                  <div className="flex w-full items-center gap-2.5">
                    {task.assignee_name ? (
                      <select
                        value={task.assignee_id || ""}
                        onChange={(e) => {
                          void handleTaskAssignment(task.id, e.target.value);
                        }}
                        className="min-w-0 flex-1 appearance-none bg-transparent text-sm font-medium text-zinc-900 outline-none"
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
                          onChange={(e) => {
                            void handleTaskAssignment(task.id, e.target.value);
                          }}
                          className="min-w-0 flex-1 appearance-none bg-transparent text-sm text-zinc-500 outline-none"
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
                        updateLocal(task.id, { status: value });
                        void commitUpdate(task.id, { status: value });
                      }}
                      className={`appearance-none rounded-md border px-2.5 py-1 text-[13px] font-medium outline-none ${getTaskStatusBadgeClass(task.status)}`}
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
                      value={task.due_date ?? ""}
                      onChange={(e) => updateLocal(task.id, { due_date: e.target.value })}
                      onBlur={(e) => {
                        void commitUpdate(task.id, { due_date: e.target.value });
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === "Escape") e.currentTarget.blur();
                      }}
                      className="bg-transparent text-sm font-medium text-zinc-600 outline-none"
                    />
                  </div>

                  {canManage && (
                    <div className="flex w-full justify-end md:hidden">
                      <button
                        type="button"
                        onClick={() => {
                          void handleDelete(task.id);
                        }}
                        className="text-xs font-medium text-zinc-500 hover:text-zinc-900"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
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
              {filteredAvailableEmployees.length === 0 ? (
                <div className="px-4 py-6 text-sm text-zinc-500">No available members found.</div>
              ) : (
                filteredAvailableEmployees.map((employee) => (
                  <label key={employee.user_id} className="flex items-center gap-3 border-b border-zinc-100 px-4 py-3 last:border-b-0">
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
