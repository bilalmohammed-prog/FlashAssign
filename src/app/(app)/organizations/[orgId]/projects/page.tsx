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
import { usePageHeader } from "@/components/layout/PageHeaderContext";
import { useToast } from "@/components/providers/toast";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Calendar, MoreHorizontal, Pencil, Plus, Search, Trash2 } from "lucide-react";
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
  } catch {
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

function getAnchoredPopoverPosition(triggerRect: DOMRect, panelWidth: number, panelHeight: number): FloatingPanelPosition {
  const viewportPadding = 12;
  const gap = 6;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const openUpward = triggerRect.bottom + panelHeight + gap > viewportHeight - viewportPadding;

  const top = openUpward
    ? Math.max(viewportPadding, triggerRect.top - panelHeight - gap)
    : Math.min(triggerRect.bottom + gap, viewportHeight - panelHeight - viewportPadding);

  const preferredLeft = triggerRect.right - panelWidth;
  const left = Math.min(
    Math.max(preferredLeft, viewportPadding),
    viewportWidth - panelWidth - viewportPadding
  );

  return { top, left };
}

const desktopProjectsTableGrid =
  "md:grid-cols-[minmax(0,2fr)_120px_120px_140px_120px_48px]";

export default function ProjectsPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const router = useRouter();
  const { addToast } = useToast();
  const { setPageHeader } = usePageHeader();
  const role = useOrgRole();
  const canManage = role === "owner" || role === "admin" || role === "manager";

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [membersList, setMembersList] = useState<Array<{ user_id: string; name: string }>>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [memberFilter, setMemberFilter] = useState("");
  const [projectMeta, setProjectMeta] = useState<Record<string, { memberCount?: number; completed?: number; total?: number }>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ProjectStatus>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
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
      const map: Record<string, { memberCount?: number; completed?: number; total?: number }> = {};

      await Promise.all(
        projects.map(async (p) => {
          try {
            const members = await listProjectMembers(p.id);
            const memberCount = members.length;

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

            map[p.id] = { memberCount, completed, total };
          } catch {
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
      } catch {
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
    setProjects((prev) => prev.filter((p) => p.id !== id));

    try {
      await deleteProject(id);
      await loadProjects();
    } catch {
      addToast("Delete failed", "error");
      setProjects(backup);
    }
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

  useEffect(() => {
    setPageHeader(
      <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative w-full sm:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <Input
              placeholder="Search projects"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 border-zinc-200 bg-white pl-9 text-sm text-zinc-700 placeholder:text-zinc-400 focus-visible:ring-2 focus-visible:ring-indigo-500"
            />
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
            className="h-9 shrink-0 rounded-lg border border-indigo-500 bg-indigo-500 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-600"
          >
            <Plus className="mr-2 h-4 w-4 opacity-90" />
            New Project
          </Button>
        )}
      </div>
    );

    return () => {
      setPageHeader(null);
    };
  }, [canManage, searchQuery, setPageHeader, statusFilter]);

  return (
    <div className="flex w-full flex-col gap-4 pb-12">
      {loading ? (
        <div className="w-full overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-200/80 bg-zinc-50/80 px-6 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Projects
          </div>
          <div className="space-y-0 divide-y divide-zinc-100">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className={`grid grid-cols-1 gap-3 px-4 py-4 md:items-center md:gap-4 md:px-6 md:py-3 ${desktopProjectsTableGrid}`}
              >
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-5 w-24" />
                <div className="hidden justify-end md:flex">
                  <Skeleton className="h-8 w-8 rounded-md" />
                </div>
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

          <div className="w-full overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
            <div
              className={`hidden items-center gap-4 border-b border-zinc-200/80 bg-zinc-50/80 px-6 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500 md:grid ${desktopProjectsTableGrid}`}
            >
              <div className="min-w-0">Project</div>
              <div className="whitespace-nowrap">Members</div>
              <div className="whitespace-nowrap">Status</div>
              <div className="whitespace-nowrap">Progress</div>
              <div className="whitespace-nowrap">Due Date</div>
              <div aria-hidden="true" />
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
                      className={`group relative flex flex-col items-start gap-3 px-4 py-3 transition-colors hover:bg-zinc-50/50 md:grid md:items-center md:gap-4 md:px-6 md:py-3 ${desktopProjectsTableGrid}`}
                    >
                      <div className="flex w-full min-w-0 flex-col">
                        <span className="truncate text-[15px] font-medium text-zinc-900" title={p.name}>{p.name}</span>
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
                                    } catch {
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

                      <div className="hidden md:flex md:items-center">
                        <span className="whitespace-nowrap text-sm text-zinc-500">
                          {`${meta.memberCount ?? 0}`}
                        </span>
                      </div>

                      <div className="hidden md:flex md:items-center md:gap-2">
                        <select
                          value={p.status}
                          onChange={async (e) => {
                            const nv = e.target.value as ProjectStatus;
                            try {
                              await updateProjectAction(p.id, { status: nv });
                              setProjects((prev) => prev.map((pp) => (pp.id === p.id ? { ...pp, status: nv } : pp)));
                            } catch {
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

                      <div className="hidden min-w-0 md:flex md:flex-col md:items-start md:gap-2">
                        <div className="w-24">
                          <div className="h-1.5 w-full rounded-full bg-zinc-100">
                            <div style={{ width: `${progressPct}%` }} className="h-2 rounded-full bg-emerald-500" />
                          </div>
                        </div>
                        <span className="whitespace-nowrap text-xs text-zinc-500">{progressText}</span>
                      </div>

                      <div className="hidden min-w-0 items-center text-sm text-zinc-500 md:flex">
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenDuePopoverId((id) => (id === p.id ? null : p.id));
                            }}
                            className="flex items-center gap-2 whitespace-nowrap text-sm font-medium text-zinc-600"
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
                                  } catch {
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

                      <div className="hidden w-full shrink-0 md:flex md:items-center md:justify-end">
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
                            className="inline-flex h-8 w-8 shrink-0 items-center justify-center self-center rounded-md text-zinc-400 transition-[background-color,color] hover:bg-zinc-100 hover:text-zinc-700 focus-visible:bg-zinc-100 focus-visible:text-zinc-700 focus-visible:outline-none group-hover:text-zinc-600"
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
              openRenameCard(actionsMenu.projectId, actionsMenu.projectName, actionsMenu.triggerRect);
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
          className="fixed z-[80] w-[272px] rounded-lg border border-zinc-200/90 bg-white p-3 shadow-lg shadow-zinc-900/8"
          style={{
            ...getAnchoredPopoverPosition(renameCard.triggerRect, 272, 136),
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-2.5">
            <p className="text-[13px] font-semibold text-zinc-900">Rename project</p>
            <p className="mt-0.5 text-[11px] text-zinc-500">Update the project name inline.</p>
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
            className="h-8 rounded-md border-zinc-200 px-2.5 text-sm shadow-none focus-visible:ring-1 focus-visible:ring-indigo-500"
            placeholder="Project name"
          />

          <div className="mt-3 flex items-center justify-end gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRenameCard(null)}
              className="h-7 rounded-md px-2.5 text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                void saveRenamedProject();
              }}
              className="h-7 rounded-md bg-indigo-500 px-2.5 text-xs text-white hover:bg-indigo-600"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-[1px]">
          <div className="w-[408px] rounded-xl border border-zinc-200 bg-white p-5 text-zinc-900 shadow-md shadow-zinc-900/5">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold tracking-tight text-zinc-900">Create Project</h2>
              <p className="text-sm text-zinc-500">Set up a project, assign members, and add dates if needed.</p>
            </div>

            <div className="mt-5 space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-700">Project name</label>
                <input
                  placeholder="Project name *"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 shadow-sm outline-none transition-colors placeholder:text-zinc-400 focus:border-transparent focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-3">
                <label className="text-sm font-medium text-zinc-700">Assign members (optional)</label>

                <div className="flex flex-wrap gap-2">
                {selectedMembers.map((id) => {
                  const member = membersList.find((m) => m.user_id === id);
                  const label = member?.name ?? id;
                  return (
                    <div key={id} className="inline-flex items-center gap-2 rounded-full bg-zinc-50 px-2.5 py-1 text-sm text-zinc-700">
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 text-[11px] font-semibold text-indigo-700">{label.charAt(0)}</div>
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
                  className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 shadow-sm outline-none transition-colors placeholder:text-zinc-400 focus:border-transparent focus:ring-2 focus:ring-indigo-500"
                />

                <div className="max-h-40 overflow-auto rounded-md bg-zinc-50/50 px-1">
                  {membersLoading ? (
                    <div className="px-2 py-2 text-sm text-zinc-500">Loading members…</div>
                  ) : (
                    (membersList
                      .filter((m) => m.name.toLowerCase().includes(memberFilter.toLowerCase()))
                      .slice(0, 20)
                      .map((member) => (
                        <label
                          key={member.user_id}
                          className="flex items-center gap-3 border-b border-zinc-100 px-2 py-2 last:border-b-0 text-sm text-zinc-700"
                        >
                          <input
                            type="checkbox"
                            checked={selectedMembers.includes(member.user_id)}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedMembers((prev) => [...prev, member.user_id]);
                              else setSelectedMembers((prev) => prev.filter((id) => id !== member.user_id));
                            }}
                            className="mt-0 shrink-0"
                          />
                          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[11px] font-semibold text-indigo-700">
                            {member.name.charAt(0)}
                          </div>
                          <span className="min-w-0 flex-1 truncate">{member.name}</span>
                        </label>
                      ))) || <div className="px-2 py-2 text-sm text-zinc-500">No members</div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-500">Start date (optional)</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 shadow-sm outline-none transition-colors focus:border-transparent focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-500">Due date (optional)</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 shadow-sm outline-none transition-colors focus:border-transparent focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  onClick={() => setShowCreate(false)}
                  className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-600 transition-colors hover:bg-zinc-50"
                >
                  Cancel
                </button>

                <button
                  disabled={!name.trim() || creating}
                  onClick={handleCreate}
                  className="rounded-md border border-transparent bg-indigo-600 px-3 py-2 text-sm text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:opacity-40"
                >
                  {creating ? "Creating..." : "Create"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
