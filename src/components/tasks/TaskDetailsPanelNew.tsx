"use client";

import { useEffect, useRef, useState } from "react";
import { X, Trash2, Sparkles, ListChecks, Paperclip, Link2 } from "lucide-react";
import type { TablesUpdate } from "@/lib/types/database";
import type { TaskStatus } from "@/lib/types/task";
import { CommentsPanel } from "@/components/tasks/CommentsPanel";
import { DatePicker } from "@/components/ui/date-picker";

type ProjectResource = { id: string; name: string };
type ProjectMemberResource = { user_id: string; name: string };
type TaskDetailsTask = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  start_date: string | null;
  due_date: string | null;
  project_id: string | null;
  assignee_id?: string | null;
  assignee_name?: string | null;
  project_name?: string | null;
  created_at: string;
};

type TaskDetailPanelProps = {
  task: TaskDetailsTask;
  orgId: string;
  currentUserId: string | null;
  canManage: boolean;
  canEditStatus: boolean;
  projects?: ProjectResource[];
  projectMembers?: ProjectMemberResource[];
  savingId: string | null;
  onClose: () => void;
  onCommitUpdate: (taskId: string, updates: TablesUpdate<"tasks">) => void;
  onProjectChange?: (taskId: string, projectId: string | null) => void;
  onAssign?: (taskId: string, resourceId: string | null) => void | Promise<void>;
  onRequestDelete: (taskId: string) => void;
};

function getTaskStatusBadgeClass(status: string | null) {
  if (status === "done") return "bg-emerald-50 text-emerald-700 border-emerald-200/60";
  if (status === "in_progress") return "bg-indigo-50 text-indigo-700 border-indigo-200/60";
  if (status === "blocked") return "bg-amber-50 text-amber-700 border-amber-200/60";
  return "bg-zinc-100 text-zinc-700 border-zinc-200/60";
}

function formatCreatedLabel(value: string) {
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function TaskDetailsPanel({
  task,
  orgId,
  currentUserId,
  canManage,
  canEditStatus,
  projects,
  projectMembers,
  onAssign,
  savingId,
  onClose,
  onCommitUpdate,
  onProjectChange,
  onRequestDelete,
}: TaskDetailPanelProps) {
  const [titleValue, setTitleValue] = useState(task.title);
  const [descriptionValue, setDescriptionValue] = useState(task.description ?? "");
  const titleRef = useRef<HTMLTextAreaElement>(null);

  // task prop can change under us (refetch / realtime) — resync edit buffers
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
        setTitleValue(task.title);
        setDescriptionValue(task.description ?? "");
    });

    return () => cancelAnimationFrame(frame);
    }, [task.id, task.title, task.description]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // autosize the title textarea like ClickUp's wrapping title field
  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [titleValue]);

  const fieldsDisabled = !canManage;
  const statusDisabled = !canManage && !canEditStatus;
  const dateDisabled = !canManage && !canEditStatus;
  const workspaceOptions = projects ?? [];
  const hasAssigneeControl = Boolean(projectMembers?.length && onAssign);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-8">
      <div
        className="absolute inset-0 bg-zinc-900/40 backdrop-blur-[2px] animate-in fade-in duration-150"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        className="relative flex h-full w-full max-w-[1200px] flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl animate-in zoom-in-95 fade-in duration-150"
      >
        {/* Top bar */}
        <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-5 py-2.5">
          <div className="flex min-w-0 items-center gap-1.5 text-xm text-zinc-500">
            <span className="truncate font-medium text-zinc-700">
              Project: {task.project_name ?? "No workspace"}
            </span>
            {savingId === task.id && (
              <span className="ml-2 shrink-0 text-xs text-zinc-400">Saving…</span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {canManage && (
              <button
                type="button"
                onClick={() => onRequestDelete(task.id)}
                title="Delete task"
                className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              title="Close"
              className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Body: left content + right activity rail */}
        <div className="flex min-h-0 flex-1">
          {/* Left column */}
          <div className="min-w-0 flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 py-5 sm:px-8 flex flex-col">
            <textarea
              ref={titleRef}
              value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)}
              onBlur={(e) => {
                const next = e.target.value.trim();
                if (next && next !== task.title) {
                  onCommitUpdate(task.id, { title: next });
                } else {
                  setTitleValue(task.title);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  e.currentTarget.blur();
                }
              }}
              disabled={fieldsDisabled}
              rows={1}
              className="w-full resize-none rounded-md px-1.5 py-1 text-2xl font-semibold leading-snug text-zinc-900 outline-none transition-colors disabled:cursor-default hover:bg-zinc-50 focus:bg-white focus:ring-2 focus:ring-indigo-500"
            />


            {/* Field grid */}
            <div className="mt-5 grid grid-cols-1 gap-x-8 gap-y-3 border-b border-zinc-100 pb-5 sm:grid-cols-2">
              <div className="flex items-center gap-4">
                <span className="w-28 shrink-0 text-sm text-zinc-500">Status</span>
                <select
                  value={task.status ?? "todo"}
                  onChange={(e) => onCommitUpdate(task.id, { status: e.target.value as TaskStatus })}
                  disabled={statusDisabled}
                  className={`appearance-none rounded-md border px-2.5 py-1 text-[13px] font-medium outline-none disabled:cursor-default ${getTaskStatusBadgeClass(task.status)}`}
                >
                  <option value="todo">To Do</option>
                  <option value="in_progress">In Progress</option>
                  <option value="blocked">Blocked</option>
                  <option value="done">Completed</option>
                </select>
              </div>

              {hasAssigneeControl ? (
                <div className="flex items-center gap-4">
                  <span className="w-28 shrink-0 text-sm text-zinc-500">Assignee</span>
                  <select
                    value={task.assignee_id || ""}
                    onChange={(e) => void onAssign?.(task.id, e.target.value || null)}
                    disabled={fieldsDisabled}
                    className={`appearance-none bg-transparent text-sm font-medium outline-none disabled:cursor-default ${
                      task.assignee_id ? "text-zinc-900" : "italic text-zinc-400"
                    }`}
                  >
                    <option value="">Unassigned</option>
                    {projectMembers?.map((member) => (
                      <option key={member.user_id} value={member.user_id}>
                        {member.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <span className="w-28 shrink-0 text-sm text-zinc-500">Workspace</span>
                  <select
                    value={task.project_id || ""}
                    onChange={(e) => onProjectChange?.(task.id, e.target.value || null)}
                    disabled={fieldsDisabled}
                    className={`appearance-none bg-transparent text-sm font-medium outline-none disabled:cursor-default ${
                      task.project_id ? "text-zinc-900" : "italic text-zinc-400"
                    }`}
                  >
                    <option value="">No workspace</option>
                    {workspaceOptions.map((project) => (
                      <option key={project.id} value={project.id}>{project.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center gap-4">
                <span className="w-28 shrink-0 text-sm text-zinc-500">Start date</span>
                <DatePicker
                  disabled={!canManage}
                  value={task.start_date || ""}
                  variant="ghost"
                  className="-ml-0 h-auto px-0 py-0 text-sm font-normal text-zinc-600 hover:bg-transparent hover:text-zinc-900"
                  placeholder="Not set"
                  onChange={async (val) => {
                    await onCommitUpdate(task.id, { start_date: val || null });
                  }}
                />
              </div>

              <div className="flex items-center gap-4">
                <span className="w-28 shrink-0 text-sm text-zinc-500">Due date</span>
                <DatePicker
                  disabled={!canManage}
                  value={task.due_date || ""}
                  variant="ghost"
                  className="h-auto px-0 py-0 text-sm font-normal text-zinc-600 hover:bg-transparent hover:text-zinc-900"
                  placeholder="Not set"
                  onChange={async (val) => {
                    await onCommitUpdate(task.id, { due_date: val || null });
                  }}
                />
              </div>

              <div className="flex items-center gap-4 sm:col-span-2">
                <span className="w-28 shrink-0 text-sm text-zinc-500">Created</span>
                <span className="text-sm text-zinc-700">{formatCreatedLabel(task.created_at)}</span>
              </div>
            </div>

            {/* Description */}
            <div className="mt-5 flex min-h-0 flex-1 flex-col">
  <div className="mb-2 flex items-center justify-between">
    <span className="text-sm font-medium text-zinc-700">
      Description
    </span>
    {descriptionValue.length > 0 && (
      <span className="text-xs text-zinc-400">
        {descriptionValue.length} characters
      </span>
    )}
  </div>

  <textarea
    ref={descriptionRef}
    value={descriptionValue}
    onChange={(e) => setDescriptionValue(e.target.value)}
    onBlur={(e) => {
      const next = e.currentTarget.value;
      if (next !== (task.description ?? "")) {
        onCommitUpdate(task.id, { description: next || null });
      }
    }}
    disabled={fieldsDisabled}
    placeholder="Add a description..."
    className="min-h-0 w-full flex-1 resize-none rounded-lg border border-zinc-200 bg-zinc-50/50 px-3.5 py-3 text-sm leading-6 text-zinc-700 outline-none transition-all placeholder:text-zinc-400 hover:border-zinc-300 hover:bg-zinc-50 focus:border-indigo-300 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 disabled:cursor-default disabled:hover:border-zinc-200 disabled:hover:bg-zinc-50/50"
  />
</div>
          </div>

          {/* Right activity rail */}
          <div className="flex w-full max-w-[450px] shrink-0 flex-col border-l border-zinc-200 bg-zinc-50/40">
            
            <div className="min-h-0 flex-1 overflow-y-auto">
              <CommentsPanel
                taskId={task.id}
                orgId={orgId}
                currentUserId={currentUserId}
                canManageAll={canManage}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}