"use client";

import { useOrgRole } from "@/hooks/useOrgRole";
import { getWorkspaceCapabilities } from "@/lib/auth/ui-capabilities";
import { isAppRole, toAppRole } from "@/lib/auth/permissions";
import { createProjectAction } from "@/actions/project/create";
import { assignProjectMember } from "@/actions/project/assignProjectMember";
import { updateProjectAction } from "@/actions/project/update";
import { listProjectsWithMetaAction, type ProjectWithMeta } from "@/actions/project/listWithMeta";
import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { deleteProject } from "@/actions/project/deleteProject";
import { useToast } from "@/components/providers/toast";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  AlertCircle,
  ArrowRight,
} from "lucide-react";
import { createPortal } from "react-dom";
import { listOrgMembers } from "@/actions/organization/listOrgMembers";
import { DatePicker } from "@/components/ui/date-picker";

type ProjectStatus = "active" | "paused" | "archived";

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

type ProjectsClientPageProps = {
  orgId: string;
  initialProjects: ProjectWithMeta[];
  initialTotalProjects: number;
};

function formatDate(date?: string | null) {
  if (!date) return null;

  try {
    return new Date(date).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return date;
  }
}

function isOverdue(endDate?: string | null, progressPct?: number) {
  if (!endDate) return false;
  if ((progressPct ?? 0) >= 100) return false;
  return new Date(endDate) < new Date();
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

function getFloatingPanelPosition(triggerRect: DOMRect, panelWidth: number, panelHeight: number) {
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

function getAnchoredPopoverPosition(triggerRect: DOMRect, panelWidth: number, panelHeight: number) {
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

// 10/10 Layout adjustment: Uniform grid column tracks with layout spacing constraints
const desktopProjectsTableGrid =
  "md:grid-cols-[minmax(0,2.5fr)_100px_130px_140px_130px_180px_48px]";

export default function ProjectsClientPage({ orgId, initialProjects, initialTotalProjects }: ProjectsClientPageProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const role = useOrgRole();
  const canManage =
    role && isAppRole(role) ? getWorkspaceCapabilities(toAppRole(role)).canManageProjects : false;

  const hydrationStartRef = useRef<number | null>(null);
  const renderCountRef = useRef(0);
  const [projects, setProjects] = useState<ProjectWithMeta[]>(initialProjects);
  const [loading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [membersList, setMembersList] = useState<Array<{ user_id: string; name: string; email: string | null }>>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [memberFilter, setMemberFilter] = useState("");
  const [totalProjects, setTotalProjects] = useState(initialTotalProjects);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ProjectStatus>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [createStartDate, setCreateStartDate] = useState("");
  const [createEndDate, setCreateEndDate] = useState("");
  const [startDateFilter, setStartDateFilter] = useState("");
  const [dueDateFilter, setDueDateFilter] = useState("");
  const [hasMore, setHasMore] = useState(initialProjects.length === 12);
  const [loadingMore, setLoadingMore] = useState(false);
  const [savingProjectId, setSavingProjectId] = useState<string | null>(null);
  const [openDuePopoverId, setOpenDuePopoverId] = useState<string | null>(null);
  const [openStartPopoverId, setOpenStartPopoverId] = useState<string | null>(null);
  const [actionsMenu, setActionsMenu] = useState<ProjectActionMenuState | null>(null);
  const [renameCard, setRenameCard] = useState<RenameProjectState | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const actionsMenuRef = useRef<HTMLDivElement | null>(null);
  const renameCardRef = useRef<HTMLDivElement | null>(null);
  const endDateDraftRef = useRef<Record<string, string | null>>({});
  const startDateDraftRef = useRef<Record<string, string | null>>({});
  const requestIdRef = useRef(0);
  const firstSearchRef = useRef(true);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const loadingMoreRef = useRef(false);
  const [sortBy, setSortBy] = useState<"name" | "progress" | "start_date" | "end_date">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
const headingRef = useRef<HTMLDivElement>(null);
const [headingGone, setHeadingGone] = useState(false);

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
  useEffect(() => {
    if (searchQuery === debouncedSearch) return;
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, debouncedSearch]);

  const PAGE_SIZE = 12;
  const projectsCountRef = useRef(projects.length);
  const addToastRef = useRef(addToast);

  useEffect(() => {
    projectsCountRef.current = projects.length;
  }, [projects.length]);

  useEffect(() => {
    addToastRef.current = addToast;
  }, [addToast]);

  useEffect(() => {
    hydrationStartRef.current = performance.now();
    console.time("[perf] page projects hydration");
    console.timeEnd("[perf] page projects hydration");
  }, []);

  useEffect(() => {
    renderCountRef.current += 1;
    if (renderCountRef.current > 1) {
      console.info(
        `[render] projects #${renderCountRef.current} projects=${projects.length} loadingMore=${loadingMore} filters=${statusFilter}/${searchQuery.length}`
      );
    }
  }, [loadingMore, projects.length, searchQuery.length, statusFilter]);

  function handleSort(column: typeof sortBy) {
    if (sortBy === column) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortOrder("asc");
    }
  }

  function SortIcon(column: typeof sortBy) {
    if (sortBy !== column) {
      return <ArrowUpDown className="h-3.5 w-3.5 text-zinc-400" />;
    }
    return sortOrder === "asc"
      ? <ArrowUp className="h-3.5 w-3.5 text-indigo-600" />
      : <ArrowDown className="h-3.5 w-3.5 text-indigo-600" />;
  }

  const loadMoreProjects = useCallback(async () => {
    if (!orgId || loadingMoreRef.current) return;
    try {
      loadingMoreRef.current = true;
      setLoadingMore(true);
      const currentLength = projectsCountRef.current;
      const data = await listProjectsWithMetaAction({
        organizationId: orgId,
        pageSize: PAGE_SIZE,
        pageOffset: currentLength,
        search: debouncedSearch,
        status: statusFilter,
        startDate: startDateFilter || undefined,
        dueDate: dueDateFilter || undefined,
        sortBy,
        sortOrder,
      });
      setProjects((prev) => {
        const merged = [...prev, ...data.projects];
        return Array.from(new Map(merged.map((p) => [p.id, p])).values());
      });
      setTotalProjects(data.totalCount);
      setHasMore(data.projects.length === PAGE_SIZE);
    } catch (err) {
      console.error("Load projects failed:", err);
      addToastRef.current("Failed to load projects", "error");
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [orgId, debouncedSearch, statusFilter, startDateFilter, dueDateFilter, sortBy, sortOrder]);

  const searchProjects = useCallback(
    async (query: string) => {
      if (!orgId) return;
      const requestId = ++requestIdRef.current;
      try {
        const data = await listProjectsWithMetaAction({
          organizationId: orgId,
          pageSize: PAGE_SIZE,
          pageOffset: 0,
          search: query,
          startDate: startDateFilter || undefined,
          dueDate: dueDateFilter || undefined,
          status: statusFilter,
          sortBy,
          sortOrder,
        });
        if (requestId !== requestIdRef.current) return;
        setProjects(data.projects);
        setTotalProjects(data.totalCount);
        setHasMore(data.projects.length === PAGE_SIZE);
      } catch (err) {
        console.error(err);
      }
    },
    [orgId, statusFilter, startDateFilter, dueDateFilter, sortBy, sortOrder]
  );

  useEffect(() => {
    if (firstSearchRef.current) {
      firstSearchRef.current = false;
      return;
    }
    void searchProjects(debouncedSearch);
  }, [debouncedSearch, searchProjects]);

  useEffect(() => {
    if (!hasMore || loadingMore) return;
    const element = loadMoreRef.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);
        void loadMoreProjects();
      },
      { rootMargin: "300px" }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loadMoreProjects]);

  async function handleCreate() {
    if (!name.trim()) return;
    try {
      setCreating(true);
      const created = await createProjectAction({
        name: name.trim(),
        status: "active",
        startDate: createStartDate || null,
        endDate: createEndDate || null,
      });
      const memberAssignmentResults =
        selectedMembers.length > 0 && created?.id
          ? await Promise.allSettled(
              selectedMembers.map((uid) => assignProjectMember(created.id, uid, orgId))
            )
          : [];
      const assignedMemberCount = memberAssignmentResults.filter(
        (result) => result.status === "fulfilled"
      ).length;
      if (created?.id) {
        setProjects((prev) => [
          {
            id: created.id,
            name: created.name,
            status: created.status ?? "active",
            startDate: created.start_date ?? null,
            endDate: created.end_date ?? null,
            memberCount: assignedMemberCount,
            completed: 0,
            total: 0,
          },
          ...prev,
        ]);
      }
      if (memberAssignmentResults.some((result) => result.status === "rejected")) {
        addToastRef.current("Project created, but failed to assign some members", "error");
      }
      setShowCreate(false);
      setName("");
      setCreateStartDate("");
      setCreateEndDate("");
      setSelectedMembers([]);
    } catch {
      addToastRef.current("Create failed", "error");
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
        const fetchStart = performance.now();
        const res = await listOrgMembers(orgId);
        console.info(`[perf] projects listOrgMembers ${(performance.now() - fetchStart).toFixed(1)}ms`);
        if (!cancelled) setMembersList(res.data ?? []);
      } catch (err) {
        console.error("Failed to load members:", err);
        addToastRef.current("Failed to load members", "error");
      } finally {
        if (!cancelled) setMembersLoading(false);
      }
    }
    void loadMembers();
    return () => { cancelled = true; };
  }, [showCreate, orgId]);

  async function handleDelete(id: string) {
    if (!confirm("Delete this project?")) return;
    const backup = projects;
    setProjects((prev) => prev.filter((project) => project.id !== id));
    try {
      await deleteProject(id);
    } catch {
      addToastRef.current("Delete failed", "error");
      setProjects(backup);
    }
  }

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

  function openActionsMenu(project: ProjectWithMeta, triggerRect: DOMRect) {
    setRenameCard(null);
    setActionsMenu({ projectId: project.id, projectName: project.name, triggerRect });
  }

  function openRenameCard(projectId: string, projectName: string, triggerRect: DOMRect) {
    setActionsMenu(null);
    setRenameCard({ projectId, projectName, draftName: projectName, triggerRect });
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
      setProjects((prev) =>
        prev.map((project) => (project.id === renameCard.projectId ? { ...project, name: nextName } : project))
      );
      addToastRef.current("Project renamed", "success");
      setRenameCard(null);
    } catch {
      addToastRef.current("Failed to rename project", "error");
    }
  }

  const projectsToolbar = (
    <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full flex-1 max-w-xl">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-900" />
          <Input
            placeholder="Search projects"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 border-zinc-200 bg-white pl-9 text-sm text-zinc-700 placeholder:text-zinc-500 focus-visible:ring-2 focus-visible:ring-indigo-500 border-zinc-300 shadow-sm"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as "all" | ProjectStatus)}
          className="h-9 w-full cursor-pointer rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-700 outline-none transition-colors focus:border-transparent focus:ring-2 focus:ring-indigo-500 sm:w-44 border-zinc-300 shadow-sm"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="archived">Archived</option>
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

      {canManage && (
        <Button
          onClick={() => setShowCreate(true)}
          className="h-9 shrink-0 cursor-pointer rounded-lg border border-indigo-500 bg-indigo-500 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-500/90 hover:border-indigo-500/90 "
        >
          <Plus className="mr-2 h-4 w-4 opacity-90" />
          New Project
        </Button>
      )}
    </div>
  );

  const filteredProjects = projects;

  return (
    <div className="flex w-full flex-col gap-4 pb-12">
      {/* ── Page heading ── */}
      <div ref={headingRef} className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Projects</h1>
        <p className="z-60 text-sm text-zinc-500">Manage projects, status, and workspace members.</p>
      </div>

      {loading ? (
        <div className="w-full overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-200/80 bg-zinc-50/80 px-6 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Projects
          </div>
          <div className="space-y-0 divide-y divide-zinc-100">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className={`grid grid-cols-1 gap-3 px-4 py-4 md:items-center md:gap-4 md:px-6 md:py-3.5 ${desktopProjectsTableGrid}`}
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
        <div className="flex flex-col">
          {/* ── Sticky toolbar + column headers ── */}
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
              <div className="flex-1">{projectsToolbar}</div>
            </div>

            {/* Count line — inline and compact */}
            <div className="flex items-center justify-between border-b border-zinc-300 bg-zinc-200/80 px-6 py-2">
              <p className="text-[12px] text-zinc-600">
                Showing{" "}
                <span className="font-medium text-zinc-600">{projects.length}</span>
                {" "}of{" "}
                <span className="font-medium text-zinc-600">{totalProjects}</span>
                {" "}projects
              </p>
            </div>

            <div
              className={`hidden items-center gap-4 border-b border-zinc-200 bg-zinc-200/80 px-6 py-3 text-[13px] font-medium uppercase tracking-wider text-zinc-500 md:grid ${desktopProjectsTableGrid}`}
            >
              <div
                onClick={() => handleSort("name")}
                className="flex cursor-pointer select-none items-center gap-1 hover:text-zinc-800"
              >
                Project {SortIcon("name")}
              </div>
              <div className="whitespace-nowrap">Members</div>
              <div className="whitespace-nowrap">Status</div>
              <div
                onClick={() => handleSort("progress")}
                className="flex cursor-pointer select-none items-center gap-1 hover:text-zinc-800"
              >
                Progress {SortIcon("progress")}
              </div>
              <div
                onClick={() => handleSort("start_date")}
                className="flex cursor-pointer select-none items-center gap-1 hover:text-zinc-800"
              >
                Start date {SortIcon("start_date")}
              </div>
              <div
                onClick={() => handleSort("end_date")}
                className="flex cursor-pointer select-none items-center gap-1 hover:text-zinc-800"
              >
                Due date {SortIcon("end_date")}
              </div>
              <div aria-hidden="true" />
            </div>

          </div>

          {projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 rounded-b-xl border border-t-0 border-dashed border-zinc-200 bg-zinc-50/60 p-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-indigo-100 bg-indigo-50">
                <Calendar className="h-5 w-5 text-indigo-500" />
              </div>
              <div className="space-y-1">
                <h2 className="text-sm font-semibold text-zinc-900">No projects yet</h2>
                <p className="max-w-xs text-sm text-zinc-400">Create a project to organize work, add team members, and track delivery.</p>
              </div>
              {canManage && (
                <Button
                  onClick={() => setShowCreate(true)}
                  className="h-9 border-transparent bg-indigo-500 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-600"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create project
                </Button>
              )}
            </div>
          ) : null}

          <div className="w-full overflow-hidden rounded-b-xl border border-t-0 border-zinc-200 bg-white shadow-sm">
            <div className="divide-y divide-zinc-100">
              {filteredProjects.map((project) => {
                const hasTaskData = project.total > 0;
                const progressPct = hasTaskData
                  ? Math.round((project.completed / project.total) * 100)
                  : 0;
                const progressText = hasTaskData
                  ? `${project.completed} / ${project.total} tasks`
                  : null;
                const overdue = isOverdue(project.endDate, progressPct);
                const formattedStart = formatDate(project.startDate);
                const formattedDue = formatDate(project.endDate);

                return (
                  <div
                    key={project.id}
                    onClick={() => router.push(`/organizations/${orgId}/projects/${project.id}`)}
                    className={`group relative flex flex-col items-start gap-3 px-4 py-4 transition-colors hover:bg-zinc-100/60 md:grid md:items-center md:gap-4 md:px-6 md:py-3.5 ${desktopProjectsTableGrid}`}
                  >
                    {/* Project name with strict layout guardrails */}
                    <div className="flex w-full min-w-0 flex-col justify-center">
                      <span
                        className="block truncate text-sm font-medium text-zinc-900"
                        title={project.name}
                      >
                        {project.name}
                      </span>
                      <div className="mt-1 flex items-center gap-2 md:hidden">
                        <span className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium ${getStatusBadgeClass(project.status)}`}>
                          {project.status}
                        </span>
                        <span className="h-1 w-1 rounded-full bg-zinc-300" />
                        {/* underinspection for dead code */}
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (openDuePopoverId !== project.id) {
                                endDateDraftRef.current[project.id] = project.endDate ?? null;
                              }
                              setOpenDuePopoverId((id) => (id === project.id ? null : project.id));
                            }}
                            className="text-xs text-zinc-500 bg-transparent"
                          >
                            {formattedDue ?? <span className="text-zinc-300">—</span>}
                          </button>
                          {openDuePopoverId === project.id && (
                            <div onClick={(e) => e.stopPropagation()} className="absolute left-0 z-50 mt-2 w-40 rounded-md border bg-white p-2 shadow">
                              <input
                                type="date"
                                autoFocus
                                value={project.endDate ?? ""}
                                onChange={(e) => {
                                  const val = e.target.value || null;
                                  setProjects((prev) => prev.map((item) => (item.id === project.id ? { ...item, endDate: val } : item)));
                                }}
                                onBlur={async (e) => {
                                  const val = e.currentTarget.value || null;
                                  const previous = endDateDraftRef.current[project.id] ?? null;
                                  setSavingProjectId(project.id);
                                  try {
                                    await updateProjectAction(project.id, { endDate: val });
                                  } catch {
                                    addToastRef.current("Failed to update due date", "error");
                                    setProjects((prev) => prev.map((item) => (item.id === project.id ? { ...item, endDate: previous } : item)));
                                  } finally {
                                    setSavingProjectId(null);
                                    setOpenDuePopoverId(null);
                                  }
                                }}
                                className="w-full rounded-md border px-2 py-1 text-sm outline-none"
                              />
                              {savingProjectId === project.id && <div className="mt-1 text-xs text-zinc-500">Saving...</div>}
                            </div>
                          )}
                        </div>
                        {/* under inspection for dead code */}
                      </div>
                    </div>

                    {/* Members — 10/10 vertical flex alignment locked */}
                    <div className="hidden md:flex md:h-full md:items-center">
                      <span className="text-sm text-zinc-500">{project.memberCount}</span>
                    </div>

                    {/* Status — 10/10 vertical flex alignment locked */}
                    <div className="hidden md:flex md:h-full md:items-center">
                      <select
                        value={project.status}
                        onChange={async (e) => {
                          const nv = e.target.value as ProjectStatus;
                          try {
                            await updateProjectAction(project.id, { status: nv });
                            setProjects((prev) =>
                              prev.map((item) => (item.id === project.id ? { ...item, status: nv } : item))
                            );
                          } catch {
                            addToastRef.current("Failed to update status", "error");
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className={`appearance-none rounded-md border px-2.5 py-1 text-xs font-medium outline-none transition-all cursor-pointer ${getStatusBadgeClass(project.status)}`}
                      >
                        <option value="active">Active</option>
                        <option value="paused">Paused</option>
                        <option value="archived">Archived</option>
                      </select>
                    </div>

                    {/* Progress — Clean layout alignment metrics */}
                    <div className="hidden min-w-0 md:flex md:h-full md:flex-col md:justify-center md:gap-1">
                      {hasTaskData ? (
                        <div className="flex flex-col gap-1.5">
                          <div className="w-24">
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
                              <div
                                style={{ width: `${progressPct}%` }}
                                className={`h-1.5 rounded-full transition-all ${progressPct === 100 ? "bg-indigo-500" : "bg-emerald-500"}`}
                              />
                            </div>
                          </div>
                          <span className="text-[11px] leading-none font-medium text-zinc-400">{progressText}</span>
                        </div>
                      ) : (
                        <span className="text-sm text-zinc-400 font-normal select-none">No tasks</span>
                      )}
                    </div>

                    {/* Start date — 10/10 vertical flex alignment locked */}
                    <div className="hidden min-w-0 md:flex md:h-full md:items-center text-sm text-zinc-500">
                      <DatePicker
                        value={project.startDate}
                        variant="ghost"
                        className="-ml-0 h-auto px-0 py-0 text-sm font-normal text-zinc-600 hover:bg-transparent hover:text-zinc-900"
                        placeholder="Set date"
                        ghostPlaceholder
                        onChange={async (val) => {
                          const previous = project.startDate;

                          setProjects((prev) =>
                            prev.map((item) =>
                              item.id === project.id
                                ? { ...item, startDate: val }
                                : item
                            )
                          );

                          setSavingProjectId(project.id);

                          try {
                            await updateProjectAction(project.id, { startDate: val });
                          } catch {
                            addToastRef.current("Failed to update start date", "error");

                            setProjects((prev) =>
                              prev.map((item) =>
                                item.id === project.id
                                  ? { ...item, startDate: previous }
                                  : item
                              )
                            );
                          } finally {
                            setSavingProjectId(null);
                          }
                        }}
                      />
                    </div>

                    {/* Due date — Strict inline block alignment rules for badges */}
                    <div className="hidden min-w-0 md:flex md:h-full md:items-center">
                      <div className="flex items-center gap-2">
                        <DatePicker
                          value={project.endDate}
                          danger={overdue}
                          variant="ghost"
                          className="h-auto px-0 py-0 text-sm font-normal text-zinc-600 hover:bg-transparent hover:text-zinc-900"
                          placeholder="Set date"
                          ghostPlaceholder
                          onChange={async (val) => {
                            const previous = project.endDate;

                            setProjects((prev) =>
                              prev.map((item) =>
                                item.id === project.id
                                  ? { ...item, endDate: val }
                                  : item
                              )
                            );

                            setSavingProjectId(project.id);

                            try {
                              await updateProjectAction(project.id, { endDate: val });
                            } catch {
                              addToastRef.current("Failed to update due date", "error");

                              setProjects((prev) =>
                                prev.map((item) =>
                                  item.id === project.id
                                    ? { ...item, endDate: previous }
                                    : item
                                )
                              );
                            } finally {
                              setSavingProjectId(null);
                            }
                          }}
                        />

                        {overdue && (
                          <span className="inline-flex items-center gap-1 rounded-md border border-red-100 bg-red-50 px-1.5 py-0.5 text-[11px] font-semibold text-red-600">
                            <AlertCircle className="h-3 w-3 shrink-0" />
                            Overdue
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions Menu Trigger Cell */}
                    <div className="hidden w-full shrink-0 md:flex md:h-full md:items-center md:justify-end">
                      {canManage && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (actionsMenu?.projectId === project.id) {
                              setActionsMenu(null);
                            } else {
                              openActionsMenu(project, e.currentTarget.getBoundingClientRect());
                            }
                          }}
                          className="cursor-pointer inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-zinc-400 transition-all hover:bg-zinc-100 hover:text-zinc-600 focus-visible:bg-zinc-100 focus-visible:outline-none group-hover:text-zinc-400"
                          aria-label={`Project actions for ${project.name}`}
                          aria-expanded={actionsMenu?.projectId === project.id}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div ref={loadMoreRef} className="h-1" />
          </div>
        </div>
      )}

      {/* Actions menu portal */}
      {typeof document !== "undefined" && actionsMenu && createPortal(
        <div
          ref={actionsMenuRef}
          className="fixed z-[70] w-56 overflow-hidden rounded-xl border border-zinc-200 bg-white p-1.5 shadow-xl shadow-zinc-200/70"
          style={{ ...getFloatingPanelPosition(actionsMenu.triggerRect, 224, 112) }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-2 pb-1 pt-0.5 text-[11px] font-medium uppercase tracking-wider text-zinc-400 truncate">
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
            Rename project
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
            Delete project
          </button>
        </div>,
        document.body
      )}

      {/* Rename popover portal */}
      {typeof document !== "undefined" && renameCard && createPortal(
        <div
          ref={renameCardRef}
          className="fixed z-[80] w-[272px] rounded-lg border border-zinc-200/90 bg-white p-3 shadow-lg shadow-zinc-900/8"
          style={{ ...getAnchoredPopoverPosition(renameCard.triggerRect, 272, 136) }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-2.5">
            <p className="text-[13px] font-semibold text-zinc-900">Rename project</p>
            <p className="mt-0.5 text-[11px] text-zinc-500">Enter a new project name.</p>
          </div>
          <Input
            autoFocus
            value={renameCard.draftName}
            onChange={(e) => setRenameCard((prev) => (prev ? { ...prev, draftName: e.target.value } : prev))}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); void saveRenamedProject(); }
              if (e.key === "Escape") { e.preventDefault(); setRenameCard(null); }
            }}
            className="h-8 rounded-md border-zinc-200 px-2.5 text-sm shadow-none focus-visible:ring-1 focus-visible:ring-indigo-500"
            placeholder="Project name"
          />
          <div className="mt-3 flex items-center justify-end gap-1.5">
            <Button variant="outline" size="sm" onClick={() => setRenameCard(null)} className="h-7 rounded-md px-2.5 text-xs">
              Cancel
            </Button>
            <Button size="sm" onClick={() => { void saveRenamedProject(); }} className="h-7 rounded-md bg-indigo-500 px-2.5 text-xs text-white hover:bg-indigo-600">
              Save
            </Button>
          </div>
        </div>,
        document.body
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-[1px]">
          <div className="w-[408px] rounded-xl border border-zinc-200 bg-white p-5 text-zinc-900 shadow-md shadow-zinc-900/5">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold tracking-tight text-zinc-900">Create project</h2>
              <p className="text-sm text-zinc-400">Set up a project, assign members, and add dates if needed.</p>
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
                {selectedMembers.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selectedMembers.map((id) => {
                      const member = membersList.find((m) => m.user_id === id);
                      const label = member?.name ?? id;
                      return (
                        <div key={id} className="inline-flex items-center gap-2 rounded-full bg-zinc-50 px-2.5 py-1 text-sm text-zinc-700">
                          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 text-[11px] font-semibold text-indigo-700">
                            {label.charAt(0)}
                          </div>
                          <span className="max-w-[120px] truncate">{label}</span>
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
                )}
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                  <Input
                    placeholder="Search members by name or email"
                    value={memberFilter}
                    onChange={(e) => setMemberFilter(e.target.value)}
                    className="h-10 pl-9"
                  />
                </div>
                <div className="max-h-48 overflow-auto rounded-lg border border-zinc-100 bg-zinc-50/40">
                  {membersLoading ? (
                    <div className="px-4 py-6 text-sm text-zinc-400">Loading members...</div>
                  ) : membersList.filter((m) => {
                    const q = memberFilter.toLowerCase();
                    return m.name.toLowerCase().includes(q) || (m.email ?? "").toLowerCase().includes(q);
                  }).length === 0 ? (
                    <div className="px-4 py-6 text-sm text-zinc-400">No members found.</div>
                  ) : (
                    membersList
                      .filter((m) => {
                        const q = memberFilter.toLowerCase();
                        return m.name.toLowerCase().includes(q) || (m.email ?? "").toLowerCase().includes(q);
                      })
                      .map((member) => (
                        <label key={member.user_id} className="flex cursor-pointer items-center gap-3 border-b border-zinc-100 px-4 py-3 last:border-b-0 hover:bg-zinc-50">
                          <input
                            type="checkbox"
                            checked={selectedMembers.includes(member.user_id)}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedMembers((prev) => [...prev, member.user_id]);
                              else setSelectedMembers((prev) => prev.filter((id) => id !== member.user_id));
                            }}
                          />
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
                            {member.name.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-zinc-900">{member.name}</div>
                            <div className="truncate text-xs text-zinc-400">{member.email ?? "Organization member"}</div>
                          </div>
                        </label>
                      ))
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-500">
                    Start date (optional)
                  </label>

                  <DatePicker
                    value={createStartDate || null}
                    onChange={(value) => setCreateStartDate(value ?? "")}
                    variant="outline"
                    className="h-10 w-full justify-start border-zinc-200 bg-white px-3 text-sm font-normal shadow-sm hover:bg-white"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-500">
                    Due date (optional)
                  </label>

                  <DatePicker
                    value={createEndDate || null}
                    onChange={(value) => setCreateEndDate(value ?? "")}
                    variant="outline"
                    className="h-10 w-full justify-start border-zinc-200 bg-white px-3 text-sm font-normal shadow-sm hover:bg-white"
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  onClick={() => setShowCreate(false)}
                  className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-600 transition-colors hover:bg-zinc-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  disabled={!name.trim() || creating}
                  onClick={handleCreate}
                  className="rounded-md cursor-pointer border border-transparent bg-indigo-600 px-3 py-2 text-sm text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:opacity-40"
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