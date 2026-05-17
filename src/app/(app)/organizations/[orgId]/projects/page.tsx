"use client";

import { useOrgRole } from "@/hooks/useOrgRole";
import { createProjectAction } from "@/actions/project/create";
import { listOrgMembers } from "@/actions/organization/listOrgMembers";
import { assignProjectMember } from "@/actions/project/assignProjectMember";
import { listProjectMembers } from "@/actions/project/listProjectMembers";
import { updateProjectAction } from "@/actions/project/update";
import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase/client";
import { useParams, useRouter } from "next/navigation";
import { deleteProject } from "@/actions/project/deleteProject";
import { useToast } from "@/components/providers/toast";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Calendar, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { createPortal } from "react-dom";

type ProjectStatus = "active" | "paused" | "archived";

type Project = {
  id: string;
  name: string;
  status: ProjectStatus;
  startDate: string | null;
  endDate: string | null;
};

type ProjectRow = {
  id: string;
  name: string;
  status: ProjectStatus | null;
  start_date: string | null;
  end_date: string | null;
  organization_id: string;
  created_at: string | null;
  deleted_at: string | null;
};

type FloatingPanelPosition = {
  top: number;
  left: number;
};

type ProjectActionMenuState = {
  projectId: string;
  projectName: string;
  triggerRect: DOMRect;
};

type RenameProjectState = {
  projectId: string;
  projectName: string;
  draftName: string;
  triggerRect: DOMRect;
};

function formatDate(date?: string | null) {
  if (!date) return "-";
  try {
    return new Date(date).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch (err) {
    return new Date(date).toLocaleDateString();
  }
}

function getStatusBadgeClass(status: ProjectStatus) {
  if (status === "active") {
    return "bg-emerald-50 text-emerald-700 border-emerald-200/60";
  }

  if (status === "paused") {
    return "bg-amber-50 text-amber-700 border-amber-200/60";
  }

  return "bg-zinc-100 text-zinc-700 border-zinc-200/60";
}

function getFloatingPanelPosition(triggerRect: DOMRect, panelWidth: number, panelHeight: number): FloatingPanelPosition {
  const viewportPadding = 12;
  const gap = 8;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const openUpward = triggerRect.bottom + panelHeight + gap > viewportHeight - viewportPadding;

  const top = openUpward
    ? Math.max(viewportPadding, triggerRect.top - panelHeight - gap)
    : Math.min(triggerRect.bottom + gap, viewportHeight - panelHeight - viewportPadding);

  const left = Math.min(
    Math.max(triggerRect.right - panelWidth, viewportPadding),
    viewportWidth - panelWidth - viewportPadding
  );

  return { top, left };
}

export default function ProjectsPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const router = useRouter();
  const { addToast } = useToast();
  const role = useOrgRole();
  const canManage = role === "owner" || role === "admin" || role === "manager";

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("active");
  const [membersList, setMembersList] = useState<Array<{ user_id: string; name: string }>>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [memberFilter, setMemberFilter] = useState("");
  const [projectMeta, setProjectMeta] = useState<Record<string, { owner?: string; memberCount?: number; completed?: number; total?: number }>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ProjectStatus>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [savingProjectId, setSavingProjectId] = useState<string | null>(null);
  const [openDuePopoverId, setOpenDuePopoverId] = useState<string | null>(null);
  const [actionsMenu, setActionsMenu] = useState<ProjectActionMenuState | null>(null);
  const [renameCard, setRenameCard] = useState<RenameProjectState | null>(null);
  const actionsMenuRef = useRef<HTMLDivElement | null>(null);
  const renameCardRef = useRef<HTMLDivElement | null>(null);

  const PAGE_SIZE = 12;

  const loadProjects = useCallback(
    async (replace = true) => {
      if (!orgId) return;

      try {
        if (replace) {
          setLoading(true);
        } else {
          setLoadingMore(true);
        }

        const currentLength = replace ? 0 : projects.length;
        const from = currentLength;
        const to = from + PAGE_SIZE - 1;

        const { data, error } = await supabase
          .from("projects")
          .select("*")
          .eq("organization_id", orgId)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .range(from, to);

        if (error) throw error;

        const mapped = (data as ProjectRow[]).map((p) => ({
          id: p.id,
          name: p.name,
          status: p.status ?? "active",
          startDate: p.start_date,
          endDate: p.end_date,
        }));

        setProjects((prev) => (replace ? mapped : [...prev, ...mapped]));
        setHasMore(data.length === PAGE_SIZE);
      } catch (err) {
        console.error("Load projects failed:", err);
        addToast("Failed to load projects", "error");
      } finally {
        if (replace) {
          setLoading(false);
        } else {
          setLoadingMore(false);
        }
      }
    },
    [orgId, projects.length, addToast]
  );

  useEffect(() => {
    if (!projects.length || !orgId) return;

    let cancelled = false;

    async function fetchMeta() {
      const map: Record<string, { owner?: string; memberCount?: number; completed?: number; total?: number }> = {};

      await Promise.all(
        projects.map(async (p) => {
          try {
            const members = await listProjectMembers(p.id);
            const memberCount = members.length;
            const owner = members[0]?.name ?? undefined;

            const { data: tasks } = await supabase
              .from("tasks")
              .select("status")
              .eq("project_id", p.id)
              .is("deleted_at", null);

            let completed = 0;
            let total = 0;
            if (Array.isArray(tasks)) {
              const arr = tasks as Array<{ status: string | null }>;
              total = arr.length;
              completed = arr.filter((t) => t.status === "done").length;
            }

            map[p.id] = { owner, memberCount, completed, total };
          } catch (e) {
            // ignore per-project failures
          }
        })
      );

      if (!cancelled) setProjectMeta(map);
    }

    void fetchMeta();

    return () => {
      cancelled = true;
    };
  }, [projects, orgId]);

  async function handleCreate() {
    if (!name.trim()) return;

    try {
      setCreating(true);

      const created = await createProjectAction({
        name: name.trim(),
        // new projects default to active (no UI to choose)
        status: "active",
        startDate: startDate || null,
        endDate: endDate || null,
      });

      if (selectedMembers.length > 0 && created?.id) {
        await Promise.all(selectedMembers.map((uid) => assignProjectMember(created.id, uid, orgId!)));
      }

      await loadProjects();

      setShowCreate(false);
      setName("");
      setStartDate("");
      setEndDate("");
      setStatus("active");
      setSelectedMembers([]);
    } catch {
      addToast("Create failed", "error");
    } finally {
      setCreating(false);
    }
  }

  useEffect(() => {
    if (!showCreate) return;
    let cancelled = false;

    async function loadMembers() {
      try {
        setMembersLoading(true);
        const res = await listOrgMembers(orgId!);
        if (!cancelled) setMembersList(res.data ?? []);
      } catch (e) {
        // ignore
      } finally {
        if (!cancelled) setMembersLoading(false);
      }
    }

    void loadMembers();

    return () => {
      cancelled = true;
    };
  }, [showCreate, orgId]);

  async function handleDelete(id: string) {
    if (!confirm("Delete this project?")) return;

    const backup = projects;
    setDeletingId(id);
    setProjects((prev) => prev.filter((p) => p.id !== id));

    try {
      await deleteProject(id);
      await loadProjects();
    } catch {
      addToast("Delete failed", "error");
      setProjects(backup);
    }

    setDeletingId(null);
  }

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as HTMLElement;
      if (!actionsMenuRef.current?.contains(target) && !renameCardRef.current?.contains(target)) {
        setActionsMenu(null);
        setRenameCard(null);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setActionsMenu(null);
        setRenameCard(null);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  function openActionsMenu(project: Project, triggerRect: DOMRect) {
    setRenameCard(null);
    setActionsMenu({ projectId: project.id, projectName: project.name, triggerRect });
  }

  function openRenameCard(projectId: string, projectName: string, triggerRect: DOMRect) {
    setActionsMenu(null);
    setRenameCard({
      projectId,
      projectName,
      draftName: projectName,
      triggerRect,
    });
  }

  async function saveRenamedProject() {
    if (!renameCard) return;

    const nextName = renameCard.draftName.trim();
    if (!nextName || nextName === renameCard.projectName.trim()) {
      setRenameCard(null);
      return;
    }

    try {
      await updateProjectAction(renameCard.projectId, { name: nextName });
      setProjects((prev) => prev.map((project) => (project.id === renameCard.projectId ? { ...project, name: nextName } : project)));
      addToast("Project renamed", "success");
      setRenameCard(null);
    } catch {
      addToast("Failed to rename project", "error");
    }
  }

  return (
    <div className="flex w-full max-w-6xl flex-col gap-4 pb-12">
      <div className="rounded-xl border border-zinc-200 bg-white px-3 py-3 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative w-full sm:max-w-sm">
              <input
                placeholder="Search projects"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 pl-9 text-sm text-zinc-700 outline-none transition-colors placeholder:text-zinc-400 focus:border-transparent focus:ring-2 focus:ring-indigo-500"
              />
              <Calendar className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "all" | ProjectStatus)}
              className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-700 outline-none transition-colors focus:border-transparent focus:ring-2 focus:ring-indigo-500 sm:w-44"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          {canManage && (
            <Button
              onClick={() => setShowCreate(true)}
              className="h-9 shrink-0 border-transparent bg-indigo-500 px-3.5 font-medium text-white shadow-sm hover:bg-indigo-600"
            >
              <Plus className="mr-2 h-4 w-4 opacity-90" />
              New Project
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-200/80 bg-zinc-50/80 px-6 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Projects
          </div>
          <div className="space-y-0 divide-y divide-zinc-100">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="grid grid-cols-1 gap-3 px-4 py-4 md:grid-cols-[minmax(240px,1fr)_120px_80px_120px_140px_120px] md:items-center md:gap-4 md:px-6 md:py-3">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-5 w-24" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-zinc-200 bg-zinc-50/60 p-8 text-center shadow-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-indigo-200 bg-indigo-50">
                <Calendar className="h-6 w-6 text-indigo-600" />
              </div>
              <h2 className="text-base font-semibold text-zinc-900">No projects yet</h2>
              <p className="max-w-md text-sm text-zinc-500">Create a project to organize work, add team members, and track delivery.</p>
              {canManage && (
                <Button onClick={() => setShowCreate(true)} className="h-9 border-transparent bg-indigo-500 px-3.5 font-medium text-white shadow-sm hover:bg-indigo-600">
                  <Plus className="mr-2 h-4 w-4" />
                  Create project
                </Button>
              )}
            </div>
          ) : null}

          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
            <div className="hidden grid-cols-[minmax(240px,1fr)_120px_80px_120px_140px_120px] items-center gap-4 border-b border-zinc-200/80 bg-zinc-50/80 px-6 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500 md:grid">
              <div>Project</div>
              <div>Owner</div>
              <div>Members</div>
              <div>Status</div>
              <div>Progress</div>
              <div>Due Date</div>
            </div>

            <div className="divide-y divide-zinc-100">
              {projects
                .filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
                .filter((p) => (statusFilter === "all" ? true : p.status === statusFilter))
                .map((p) => {
                  const meta = projectMeta[p.id] ?? {};
                  const progressText = meta.total ? `${meta.completed ?? 0}/${meta.total} tasks` : "0/0 tasks";
                  const progressPct = meta.total ? Math.round(((meta.completed ?? 0) / meta.total) * 100) : 0;

                  return (
                    <div
                      key={p.id}
                      onClick={() => router.push(`/organizations/${orgId}/projects/${p.id}`)}
                      className="group relative flex flex-col items-start gap-3 px-4 py-3 transition-colors hover:bg-zinc-50/50 md:grid md:grid-cols-[minmax(240px,1fr)_120px_80px_120px_140px_120px] md:items-center md:gap-4 md:px-6 md:py-3"
                    >
                      <div className="flex w-full min-w-0 flex-col">
                        <span className="truncate text-[15px] font-medium text-zinc-900">{p.name}</span>
                        <div className="mt-1 flex items-center gap-2 md:hidden">
                          <span className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium ${getStatusBadgeClass(p.status)}`}>{p.status}</span>
                          <span className="h-1 w-1 rounded-full bg-zinc-300" />
                          <div className="relative">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenDuePopoverId((id) => (id === p.id ? null : p.id));
                              }}
                              className="text-xs text-zinc-500 bg-transparent"
                            >
                              {p.endDate ? formatDate(p.endDate) : "No due date"}
                            </button>

                            {openDuePopoverId === p.id && (
                              <div onClick={(e) => e.stopPropagation()} className="absolute left-0 z-50 mt-2 w-40 rounded-md border bg-white p-2 shadow">
                                <input
                                  type="date"
                                  autoFocus
                                  value={p.endDate ?? ""}
                                  onChange={(e) => {
                                    const val = e.target.value || null;
                                    setProjects((prev) => prev.map((pp) => (pp.id === p.id ? { ...pp, endDate: val } : pp)));
                                  }}
                                  onBlur={async (e) => {
                                    const val = e.currentTarget.value || null;
                                    setSavingProjectId(p.id);
                                    try {
                                      await updateProjectAction(p.id, { endDate: val });
                                    } catch (err) {
                                      addToast("Failed to update due date", "error");
                                      await loadProjects();
                                    } finally {
                                      setSavingProjectId(null);
                                      setOpenDuePopoverId(null);
                                    }
                                  }}
                                  className="w-full rounded-md border px-2 py-1 text-sm outline-none"
                                />
                                {savingProjectId === p.id && <div className="mt-1 text-xs text-zinc-500">Saving...</div>}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="hidden min-w-0 md:flex md:items-center">
                        <span className="truncate text-sm text-zinc-700">{meta.owner ?? "—"}</span>
                      </div>

                      <div className="hidden md:flex md:items-center">
                        <span className="text-sm tabular-nums text-zinc-600">{meta.memberCount ?? 0}</span>
                      </div>

                      <div className="hidden md:flex md:items-center md:gap-2">
                        <select
                          value={p.status}
                          onChange={async (e) => {
                            const nv = e.target.value as ProjectStatus;
                            try {
                              await updateProjectAction(p.id, { status: nv });
                              setProjects((prev) => prev.map((pp) => (pp.id === p.id ? { ...pp, status: nv } : pp)));
                            } catch (err) {
                              addToast("Failed to update status", "error");
                            }
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className={`appearance-none rounded-md border px-2.5 py-1 text-[13px] font-medium outline-none ${getStatusBadgeClass(p.status)}`}
                        >
                          <option value="active">Active</option>
                          <option value="paused">Paused</option>
                          <option value="archived">Archived</option>
                        </select>
                      </div>

                      <div className="hidden md:flex md:flex-col md:items-start md:gap-2">
                        <div className="w-28">
                          <div className="h-2 w-full rounded-full bg-zinc-100">
                            <div style={{ width: `${progressPct}%` }} className="h-2 rounded-full bg-emerald-500" />
                          </div>
                        </div>
                        <span className="text-xs text-zinc-500">{progressText}</span>
                      </div>

                      <div className="hidden items-center text-sm text-zinc-500 md:flex">
                        <Calendar className="mr-1.5 h-3.5 w-3.5 opacity-70" />
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenDuePopoverId((id) => (id === p.id ? null : p.id));
                            }}
                            className="flex items-center gap-2 text-sm font-medium text-zinc-600"
                          >
                            <span>{p.endDate ? formatDate(p.endDate) : "No due date"}</span>
                          </button>

                          {openDuePopoverId === p.id && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="absolute right-0 z-50 mt-2 w-44 rounded-md border bg-white p-2 shadow"
                            >
                              <input
                                type="date"
                                autoFocus
                                value={p.endDate ?? ""}
                                onChange={(e) => {
                                  const val = e.target.value || null;
                                  setProjects((prev) => prev.map((pp) => (pp.id === p.id ? { ...pp, endDate: val } : pp)));
                                }}
                                onBlur={async (e) => {
                                  const val = e.currentTarget.value || null;
                                  setSavingProjectId(p.id);
                                  try {
                                    await updateProjectAction(p.id, { endDate: val });
                                  } catch (err) {
                                    addToast("Failed to update due date", "error");
                                    await loadProjects();
                                  } finally {
                                    setSavingProjectId(null);
                                    setOpenDuePopoverId(null);
                                  }
                                }}
                                className="w-full rounded-md border px-2 py-1 text-sm outline-none"
                              />
                              {savingProjectId === p.id && <div className="mt-1 text-xs text-zinc-500">Saving...</div>}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="absolute top-3 right-3 flex w-full justify-end md:static md:w-auto">
                        {canManage && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (actionsMenu?.projectId === p.id) {
                                setActionsMenu(null);
                              } else {
                                openActionsMenu(p, e.currentTarget.getBoundingClientRect());
                              }
                            }}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 bg-white/90 text-zinc-500 shadow-sm transition-all hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 md:opacity-100"
                            aria-label={`Project actions for ${p.name}`}
                            aria-expanded={actionsMenu?.projectId === p.id}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {typeof document !== "undefined" && actionsMenu && createPortal(
        <div
          ref={actionsMenuRef}
          className="fixed z-[70] w-56 overflow-hidden rounded-xl border border-zinc-200 bg-white p-1.5 shadow-xl shadow-zinc-200/70"
          style={{
            ...getFloatingPanelPosition(actionsMenu.triggerRect, 224, 112),
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-2 pb-1 pt-0.5 text-[11px] font-medium uppercase tracking-wider text-zinc-400">
            {actionsMenu.projectName}
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openRenameCard(actionsMenu.projectId, actionsMenu.projectName, e.currentTarget.getBoundingClientRect());
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-zinc-700 transition-colors hover:bg-zinc-50 hover:text-zinc-900 focus:bg-zinc-50 focus:outline-none"
          >
            <Pencil className="h-4 w-4 text-zinc-500" />
            Rename Project
          </button>

          <button
            type="button"
            onClick={async (e) => {
              e.stopPropagation();
              setActionsMenu(null);
              await handleDelete(actionsMenu.projectId);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-red-600 transition-colors hover:bg-red-50 hover:text-red-700 focus:bg-red-50 focus:outline-none"
          >
            <Trash2 className="h-4 w-4" />
            Delete Project
          </button>
        </div>,
        document.body
      )}

      {typeof document !== "undefined" && renameCard && createPortal(
        <div
          ref={renameCardRef}
          className="fixed z-[80] w-[320px] rounded-xl border border-zinc-200 bg-white p-4 shadow-2xl shadow-zinc-200/80"
          style={{
            ...getFloatingPanelPosition(renameCard.triggerRect, 320, 176),
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-zinc-900">Rename Project</p>
              <p className="mt-0.5 text-xs text-zinc-500">Update the project name inline.</p>
            </div>
          </div>

          <Input
            autoFocus
            value={renameCard.draftName}
            onChange={(e) => setRenameCard((prev) => (prev ? { ...prev, draftName: e.target.value } : prev))}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void saveRenamedProject();
              }
              if (e.key === "Escape") {
                e.preventDefault();
                setRenameCard(null);
              }
            }}
            className="h-9"
            placeholder="Project name"
          />

          <div className="mt-4 flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRenameCard(null)}
              className="h-8"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                void saveRenamedProject();
              }}
              className="h-8 bg-indigo-500 text-white hover:bg-indigo-600"
            >
              Save
            </Button>
          </div>
        </div>,
        document.body
      )}

      {hasMore && !loading && (
        <div className="flex justify-center pt-2">
          <button
            onClick={() => loadProjects(false)}
            disabled={loadingMore}
            className="rounded-md border border-zinc-200 px-4 py-2 text-sm transition-colors hover:bg-zinc-50 disabled:opacity-50"
          >
            {loadingMore ? "Loading..." : "Load more"}
          </button>
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-[420px] space-y-4 rounded-xl border border-zinc-200 bg-white p-6 text-zinc-900 shadow-sm">
            <h2 className="text-lg font-medium text-zinc-900">Create Project</h2>

            <input
              placeholder="Project name *"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-zinc-200 bg-white p-2 text-sm text-zinc-900 shadow-sm outline-none transition-colors placeholder:text-zinc-400 focus:border-transparent focus:ring-2 focus:ring-indigo-500"
            />

            {/* Member assignment (optional) */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-700">Assign members (optional)</label>

              <div className="flex flex-wrap gap-2">
                {selectedMembers.map((id) => {
                  const member = membersList.find((m) => m.user_id === id);
                  const label = member?.name ?? id;
                  return (
                    <div key={id} className="inline-flex items-center gap-2 rounded-full bg-zinc-50 px-2 py-1 text-sm text-zinc-700">
                      <div className="h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700 flex">{label.charAt(0)}</div>
                      <span className="truncate max-w-[120px]">{label}</span>
                      <button
                        type="button"
                        onClick={() => setSelectedMembers((prev) => prev.filter((s) => s !== id))}
                        className="ml-1 text-zinc-400 hover:text-zinc-700"
                        aria-label={`Remove ${label}`}
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>

              <input
                placeholder="Search members"
                value={memberFilter}
                onChange={(e) => setMemberFilter(e.target.value)}
                className="w-full rounded-md border border-zinc-200 bg-white p-2 text-sm text-zinc-900 shadow-sm outline-none transition-colors placeholder:text-zinc-400 focus:border-transparent focus:ring-2 focus:ring-indigo-500"
              />

              <div className="max-h-36 overflow-auto rounded-md border border-zinc-100 bg-white p-2">
                {membersLoading ? (
                  <div className="text-sm text-zinc-500">Loading members…</div>
                ) : (
                  (membersList
                    .filter((m) => m.name.toLowerCase().includes(memberFilter.toLowerCase()))
                    .slice(0, 20)
                    .map((member) => (
                      <label key={member.user_id} className="flex items-center gap-2 py-1 text-sm text-zinc-700">
                        <input
                          type="checkbox"
                          checked={selectedMembers.includes(member.user_id)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedMembers((prev) => [...prev, member.user_id]);
                            else setSelectedMembers((prev) => prev.filter((id) => id !== member.user_id));
                          }}
                        />
                        <div className="h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700 flex">{member.name.charAt(0)}</div>
                        <span>{member.name}</span>
                      </label>
                    ))) || <div className="text-sm text-zinc-500">No members</div>
                )}
              </div>
            </div>

            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-md border border-zinc-200 bg-white p-2 text-sm text-zinc-900 shadow-sm outline-none transition-colors focus:border-transparent focus:ring-2 focus:ring-indigo-500"
            />

            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-md border border-zinc-200 bg-white p-2 text-sm text-zinc-900 shadow-sm outline-none transition-colors focus:border-transparent focus:ring-2 focus:ring-indigo-500"
            />

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowCreate(false)}
                className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 transition-colors hover:bg-zinc-50"
              >
                Cancel
              </button>

              <button
                disabled={!name.trim() || creating}
                onClick={handleCreate}
                className="rounded-md border border-transparent bg-indigo-600 px-3 py-1.5 text-sm text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:opacity-40"
              >
                {creating ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
