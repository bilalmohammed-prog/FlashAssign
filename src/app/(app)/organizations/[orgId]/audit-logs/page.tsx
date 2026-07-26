"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams } from "next/navigation";
import { format } from "date-fns";
import {
  Search,
  MoreHorizontal,
  ArrowRight,
  ChevronRight,
  ClipboardList,
  X,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";

import { useToast } from "@/components/providers/toast";
import { listAuditLogs } from "@/actions/audit/list";
import { listOrgMembers } from "@/actions/organization/listOrgMembers";
import { AuditLog } from "@/lib/types/audit-log";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

// --- Types ---

type AuditGroup = {
  id: string;
  actor_name: string;
  action: string;
  entity_type: string;
  entity_id: string;
  created_at: string;
  logs: AuditLog[];
  actor_id: string | null;
};

type AuditFilters = {
  search: string;
  action?: "CREATE" | "UPDATE" | "DELETE";
  entityType?: "task" | "project" | "member" | "org";
  actor?: string;
  fromDate?: string;
  toDate?: string;
};

type OrganizationMember = {
  user_id: string;
  name: string;
  email: string | null;
};

const GROUP_WINDOW_MS = 60000;
const PAGE_SIZE = 25;
const EMPTY_FILTERS: AuditFilters = { search: "" };

const desktopAuditGrid =
  "md:grid-cols-[minmax(0,1.6fr)_112px_150px_1fr_150px]";

const ACTION_LABELS: Record<string, string> = {
  CREATE: "Create",
  UPDATE: "Update",
  DELETE: "Delete",
};

const ENTITY_LABELS: Record<string, string> = {
  task: "Task",
  project: "Project",
  member: "Member",
  org: "Organization",
};

// --- Badge color maps for smart rendering ---

const STATUS_COLORS: Record<string, string> = {
  todo: "bg-zinc-100 text-zinc-700 border-zinc-200",
  in_progress: "bg-indigo-50 text-indigo-700 border-indigo-200/60",
  done: "bg-emerald-50 text-emerald-700 border-emerald-200/60",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200/60",
  blocked: "bg-amber-50 text-amber-700 border-amber-200/60",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-sky-50 text-sky-700 border-sky-200/60",
  medium: "bg-zinc-100 text-zinc-700 border-zinc-200",
  high: "bg-orange-50 text-orange-700 border-orange-200/60",
  urgent: "bg-red-50 text-red-700 border-red-200/60",
};

// --- Dropdown ---

function ChangesDropdown({
  group,
  onClose,
}: {
  group: AuditGroup;
  onClose: () => void;
}) {
  const HIDDEN_FIELDS = new Set(["comment_id", "parent_comment_id"]);

const allChanges = group.logs
  .flatMap((log) => log.changes)
  .filter((c) => !HIDDEN_FIELDS.has(c.field));

const changeCount = allChanges.length;

  const dateStr = format(new Date(group.created_at), "d MMM yyyy");

  return (
    <div className="w-[380px] space-y-3 p-1">
      <div className="flex items-center justify-between px-3 pt-2 pb-1">
        <div className="flex items-center gap-2">
          <ActionBadge action={group.action} />
          <EntityBadge entityType={group.entity_type} />
        </div>
        <span className="text-[11px] tabular-nums text-zinc-400">{dateStr}</span>
      </div>

      <div className="h-px bg-zinc-100" />

      <div className="max-h-[340px] space-y-2 overflow-y-auto px-1 pb-1">
        {allChanges.length > 0 ? (
          allChanges.map((change, index) => (
            <ChangeCard
              key={index}
              field={change.field}
              before={change.before}
              after={change.after}
              action={group.action}
            />
          ))
        ) : (
          <p className="py-4 text-center text-xs text-zinc-400">
            No field changes recorded.
          </p>
        )}
      </div>
    </div>
  );
}

// --- Grouping ---

function groupAuditLogs(logs: AuditLog[]): AuditGroup[] {
  const groups: AuditGroup[] = [];

  for (const log of logs) {
    const previous = groups[groups.length - 1];

    const shouldGroup =
      previous &&
      log.action === "UPDATE" &&
      previous.action === "UPDATE" &&
      previous.actor_id === log.actor_id &&
      previous.entity_type === log.entity_type &&
      previous.entity_id === log.entity_id &&
      Math.abs(
        new Date(previous.created_at).getTime() -
          new Date(log.created_at).getTime()
      ) <= GROUP_WINDOW_MS;

    if (shouldGroup) {
      previous.logs.push(log);
    } else {
      groups.push({
        id: log.id,
        actor_name: log.actor_name,
        action: log.action,
        entity_type: log.entity_type,
        entity_id: log.entity_id,
        created_at: log.created_at,
        logs: [log],
        actor_id: log.actor_id,
      });
    }
  }

  return groups;
}

// --- Helpers ---

function getActionDotClass(action: string) {
  switch (action.toUpperCase()) {
    case "CREATE":
    case "COMPLETE":
      return "bg-emerald-500";
    case "UPDATE":
      return "bg-indigo-500";
    case "DELETE":
      return "bg-red-500";
    case "ASSIGN":
      return "bg-purple-500";
    default:
      return "bg-zinc-400";
  }
}

function getInitials(name: string) {
  return (
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase() || "?"
  );
}

function fieldLabel(field: string) {
  const displayField = field.startsWith("comment:") ? "comment" : field;

  return displayField
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function formatVal(value: unknown) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
      try {
        return format(new Date(value), "d MMM yyyy");
      } catch {
        return value;
      }
    }
    return value;
  }
  return JSON.stringify(value);
}

function tryBadge(val: string, map: Record<string, string>) {
  const cls = map[val];
  if (!cls) return null;
  return (
    <span
      className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-medium ${cls}`}
    >
      {val.replace(/_/g, " ")}
    </span>
  );
}

function smartRender(value: unknown) {
  if (value === null || value === undefined) {
    return <span className="italic text-zinc-400">—</span>;
  }
  const str = String(value);
  return (
    tryBadge(str, STATUS_COLORS) ||
    tryBadge(str, PRIORITY_COLORS) || (
      <span className="break-all font-mono text-[13px] leading-relaxed">
        {formatVal(value)}
      </span>
    )
  );
}

// --- Shared small components ---

function ActionBadge({ action }: { action: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2 py-0.5 text-xs font-medium text-zinc-700">
      <span
        className={`h-1.5 w-1.5 rounded-full ${getActionDotClass(action)}`}
        aria-hidden="true"
      />
      {ACTION_LABELS[action.toUpperCase()] ?? action}
    </span>
  );
}

function EntityBadge({ entityType }: { entityType: string }) {
  return (
    <span className="inline-flex rounded-md border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs font-medium text-zinc-600">
      {ENTITY_LABELS[entityType] ?? entityType}
    </span>
  );
}

function FilterChip({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className="group inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-600 transition-colors hover:border-zinc-300 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
    >
      {label}
      <X className="h-3 w-3 text-zinc-400 transition-colors group-hover:text-zinc-600" />
    </button>
  );
}

// --- Main Component ---

export default function AuditLogsPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const { addToast } = useToast();

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [headingGone, setHeadingGone] = useState(false);

  const [filters, setFilters] = useState<AuditFilters>(EMPTY_FILTERS);

  const cursorRef = useRef<string | undefined>(undefined);
  const hasMoreRef = useRef(false);
  const loadingMoreRef = useRef(false);
  const initialLoadingRef = useRef(true);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const headingRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const addToastRef = useRef(addToast);

  useEffect(() => {
    addToastRef.current = addToast;
  }, [addToast]);

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
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey) return;
      const target = e.target as HTMLElement;
      const isTyping =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;
      if (isTyping) return;
      e.preventDefault();
      searchInputRef.current?.focus();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void listOrgMembers(orgId).then((result) => {
      if (!cancelled && result.data) setMembers(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  const actorEmailMap = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const m of members) {
      map.set(m.user_id, m.email);
    }
    return map;
  }, [members]);

  const loadLogs = useCallback(
    async (isNewSearch: boolean, pageCursor?: string) => {
      if (!isNewSearch && loadingMoreRef.current) return;
      if (!orgId) return;

      if (isNewSearch) {
        initialLoadingRef.current = true;
        setInitialLoading(true);
        setLoadError(false);
        cursorRef.current = undefined;
      } else {
        loadingMoreRef.current = true;
        setLoadingMore(true);
      }

      try {
        const data = await listAuditLogs({
          organizationId: orgId,
          search: filters.search || undefined,
          action: filters.action,
          entityType: filters.entityType,
          actorId: filters.actor,
          fromDate: filters.fromDate,
          toDate: filters.toDate,
          cursor: isNewSearch ? undefined : pageCursor,
          limit: PAGE_SIZE,
        });

        const nextCursor =
          data.length > 0 ? data[data.length - 1].created_at : undefined;
        const more = data.length === PAGE_SIZE;

        cursorRef.current = nextCursor;
        hasMoreRef.current = more;
        setHasMore(more);
        setLogs((prev) => (isNewSearch ? data : [...prev, ...data]));
      } catch {
        if (isNewSearch) {
          setLoadError(true);
          setLogs([]);
        }
        addToastRef.current("Failed to load audit logs", "error");
      } finally {
        initialLoadingRef.current = false;
        setInitialLoading(false);
        setLoadingMore(false);
        loadingMoreRef.current = false;
      }
    },
    [orgId, filters]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadLogs(true);
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, orgId]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || loadingMore || initialLoading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);
        void loadLogs(false, cursorRef.current);
      },
      { rootMargin: "200px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, initialLoading, loadLogs]);

  const groupedLogs = useMemo(() => groupAuditLogs(logs), [logs]);

  const actorName = useMemo(
    () => members.find((m) => m.user_id === filters.actor)?.name,
    [members, filters.actor]
  );

  const activeChips = useMemo(() => {
    const chips: { key: string; label: string; onRemove: () => void }[] = [];

    if (filters.search) {
      chips.push({
        key: "search",
        label: `"${filters.search}"`,
        onRemove: () => setFilters((c) => ({ ...c, search: "" })),
      });
    }
    if (filters.action) {
      chips.push({
        key: "action",
        label: ACTION_LABELS[filters.action],
        onRemove: () => setFilters((c) => ({ ...c, action: undefined })),
      });
    }
    if (filters.entityType) {
      chips.push({
        key: "entityType",
        label: ENTITY_LABELS[filters.entityType],
        onRemove: () => setFilters((c) => ({ ...c, entityType: undefined })),
      });
    }
    if (filters.actor) {
      chips.push({
        key: "actor",
        label: actorName ?? "Unknown user",
        onRemove: () => setFilters((c) => ({ ...c, actor: undefined })),
      });
    }
    if (filters.fromDate || filters.toDate) {
      const from = filters.fromDate
        ? format(new Date(filters.fromDate), "MMM d")
        : "Any";
      const to = filters.toDate
        ? format(new Date(filters.toDate), "MMM d")
        : "Any";
      chips.push({
        key: "date",
        label: `${from} – ${to}`,
        onRemove: () =>
          setFilters((c) => ({ ...c, fromDate: undefined, toDate: undefined })),
      });
    }
    return chips;
  }, [filters, actorName]);

  const hasActiveFilters = activeChips.length > 0;

  const auditToolbar = (
    <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative w-full flex-1 max-w-xl">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input
            ref={searchInputRef}
            placeholder="Search logs"
            aria-label="Search audit logs"
            value={filters.search}
            onChange={(e) =>
              setFilters((current) => ({ ...current, search: e.target.value }))
            }
            className="h-9 border-zinc-300 bg-white pl-9 pr-9 text-sm text-zinc-700 placeholder:text-zinc-500 shadow-sm focus-visible:ring-2 focus-visible:ring-indigo-500"
          />
          {!filters.search && (
            <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-[11px] font-medium text-zinc-400">
              /
            </kbd>
          )}
        </div>

        <Select
          value={filters.action ?? "all"}
          onValueChange={(value) =>
            setFilters((current) => ({
              ...current,
              action:
                value === "all"
                  ? undefined
                  : (value as AuditFilters["action"]),
            }))
          }
        >
          <SelectTrigger
            aria-label="Filter by action"
            className="h-9 w-full border-zinc-300 bg-white text-sm text-zinc-700 shadow-sm sm:w-36"
          >
            <SelectValue placeholder="All actions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actions</SelectItem>
            <SelectItem value="CREATE">Create</SelectItem>
            <SelectItem value="UPDATE">Update</SelectItem>
            <SelectItem value="DELETE">Delete</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filters.entityType ?? "all"}
          onValueChange={(value) =>
            setFilters((current) => ({
              ...current,
              entityType:
                value === "all"
                  ? undefined
                  : (value as AuditFilters["entityType"]),
            }))
          }
        >
          <SelectTrigger
            aria-label="Filter by resource type"
            className="h-9 w-full border-zinc-300 bg-white text-sm text-zinc-700 shadow-sm sm:w-40"
          >
            <SelectValue placeholder="Any resource" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any resource</SelectItem>
            <SelectItem value="task">Task</SelectItem>
            <SelectItem value="project">Project</SelectItem>
            <SelectItem value="member">Member</SelectItem>
            <SelectItem value="org">Organization</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filters.actor ?? "all"}
          onValueChange={(value) =>
            setFilters((current) => ({
              ...current,
              actor: value === "all" ? undefined : value,
            }))
          }
        >
          <SelectTrigger
            aria-label="Filter by user"
            className="h-9 w-full border-zinc-300 bg-white text-sm text-zinc-700 shadow-sm sm:w-44"
          >
            <SelectValue placeholder="Any user" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any user</SelectItem>
            {members.map((member) => (
              <SelectItem key={member.user_id} value={member.user_id}>
                {member.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <DatePicker
            value={filters.fromDate ?? null}
            onChange={(fromDate) =>
              setFilters((current) => ({ ...current, fromDate: fromDate ?? undefined }))
            }
            placeholder="From date"
            className="h-9 w-[150px] justify-start border-zinc-300 bg-white px-3 text-sm font-normal shadow-sm hover:bg-white"
          />
          <ArrowRight className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden="true" />
          <DatePicker
            value={filters.toDate ?? null}
            onChange={(toDate) =>
              setFilters((current) => ({ ...current, toDate: toDate ?? undefined }))
            }
            placeholder="To date"
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
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 truncate max-w-[640px]">
            Audit Logs
          </h1>
          <p className="text-sm text-zinc-500">
            Track user activity, security events, and system changes.
          </p>
        </div>
      </div>

      <div className="flex flex-col">
        <div
          className={`sticky top-0 z-30 border border-b-0 border-zinc-200 bg-white transition-[border-radius] duration-150 ${
            headingGone ? "rounded-none" : "rounded-t-lg"
          }`}
        >
          {headingGone && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute top-0 left-0 right-0 h-12 -translate-y-full"
              style={{
                background:
                  "linear-gradient(to top, rgba(249,250,251,0.95) 0%, transparent 100%)",
              }}
            />
          )}
          <div className="flex items-center justify-between gap-4 rounded-t-lg border-b border-zinc-200 bg-zinc-50 px-4 py-3">
            <div className="flex-1">{auditToolbar}</div>
          </div>

          <div className="flex min-h-[41px] items-center justify-between gap-3 border-b border-zinc-200 bg-zinc-50 px-4 py-2">
            {hasActiveFilters ? (
              <div className="flex flex-wrap items-center gap-1.5">
                {activeChips.map((chip) => (
                  <FilterChip
                    key={chip.key}
                    label={chip.label}
                    onRemove={chip.onRemove}
                  />
                ))}
                <button
                  type="button"
                  onClick={() => setFilters(EMPTY_FILTERS)}
                  className="px-1.5 text-xs font-medium text-zinc-400 underline-offset-2 transition-colors hover:text-zinc-700 hover:underline"
                >
                  Clear all
                </button>
              </div>
            ) : (
              <p className="text-xs text-zinc-400">No filters applied</p>
            )}
            <p
              className="shrink-0 text-xs tabular-nums text-zinc-500"
              aria-live="polite"
            >
              <span className="font-medium text-zinc-700">{logs.length}</span>{" "}
              event{logs.length === 1 ? "" : "s"}
            </p>
          </div>

          <div
            className={`hidden items-center gap-4 border-b border-zinc-200 bg-zinc-50 px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-zinc-500 md:grid ${desktopAuditGrid}`}
          >
            <div>Actor</div>
            <div>Action</div>
            <div>Resource</div>
            <div>Changes</div>
            <div className="text-right">Time</div>
          </div>
        </div>

        {!initialLoading && loadError ? (
          <div className="flex flex-col items-center justify-center gap-4 rounded-b-xl border border-t-0 border-zinc-200 bg-white p-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-red-100 bg-red-50">
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
            <div className="space-y-1">
              <h2 className="text-sm font-semibold text-zinc-900">
                Couldn&apos;t load audit logs
              </h2>
              <p className="max-w-xs text-sm text-zinc-400">
                Something went wrong while fetching events. Check your
                connection and try again.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => void loadLogs(true)}
              className="h-9 gap-2 px-4 text-sm font-medium"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Try again
            </Button>
          </div>
        ) : !initialLoading && groupedLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 rounded-b-xl border border-t-0 border-dashed border-zinc-200 bg-zinc-50/60 p-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-indigo-100 bg-indigo-50">
              <ClipboardList className="h-5 w-5 text-indigo-500" />
            </div>
            <div className="space-y-1">
              <h2 className="text-sm font-semibold text-zinc-900">No audit logs found</h2>
              <p className="max-w-xs text-sm text-zinc-400">
                {hasActiveFilters
                  ? "Try widening your search or clearing the applied filters."
                  : "Activity across tasks, workspaces, and members will show up here."}
              </p>
            </div>
            {hasActiveFilters && (
              <Button
                variant="outline"
                onClick={() => setFilters(EMPTY_FILTERS)}
                className="h-9 px-4 text-sm font-medium"
              >
                Clear filters
              </Button>
            )}
          </div>
        ) : (
          <div className="w-full overflow-hidden rounded-b-xl border border-t-0 border-zinc-200 bg-white shadow-sm">
            <div
              aria-label="Audit log events"
              className={`divide-y divide-zinc-100 ${
                initialLoading ? "opacity-40 pointer-events-none" : ""
              }`}
            >
              {initialLoading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={i}
                      className={`flex flex-col gap-3 px-4 py-4 md:grid md:items-center md:gap-4 md:py-3.5 ${desktopAuditGrid}`}
                    >
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-8 w-8 rounded-full" />
                        <Skeleton className="h-4 w-32" />
                      </div>
                      <Skeleton className="hidden h-5 w-16 rounded md:block" />
                      <Skeleton className="hidden h-5 w-20 rounded md:block" />
                      <Skeleton className="hidden h-4 w-24 md:block" />
                      <Skeleton className="hidden h-4 w-20 md:ml-auto md:block" />
                    </div>
                  ))
                : groupedLogs.map((group) => (
                    <AuditLogGroupRow
                      key={group.id}
                      group={group}
                      actorEmail={actorEmailMap.get(group.actor_id ?? "") ?? null}
                    />
                  ))}
            </div>

            <div ref={sentinelRef} className="h-px w-full bg-transparent" />

            {loadingMore && (
              <div className="flex items-center justify-center gap-2 border-t border-zinc-100 bg-zinc-50/50 py-4 text-xs font-medium text-zinc-500">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-500" />
                Loading older events…
              </div>
            )}

            {!loadingMore && hasMore && (
              <div className="flex items-center justify-center border-t border-zinc-100 bg-zinc-50/50 py-3">
                <button
                  type="button"
                  onClick={() => void loadLogs(false, cursorRef.current)}
                  className="text-xs font-medium text-zinc-500 underline-offset-2 hover:text-zinc-800 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded px-2 py-1"
                >
                  Load older events
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// --- Row Component ---

function AuditLogGroupRow({
  group,
  actorEmail,
}: {
  group: AuditGroup;
  actorEmail: string | null;
}) {
  const allChanges = group.logs.flatMap((log) => log.changes);
  const changeCount = allChanges.length;
  const mergedCount = group.logs.length;
  const [isOpen, setIsOpen] = useState(false);

  const dateStr = format(new Date(group.created_at), "d MMM yyyy");

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <div
          role="button"
          tabIndex={0}
          aria-label={`${group.actor_name} ${ACTION_LABELS[group.action] ?? group.action} on ${
            ENTITY_LABELS[group.entity_type] ?? group.entity_type
          }, ${dateStr}`}
          className={`group flex cursor-pointer flex-col gap-3 px-4 py-4 outline-none transition-colors hover:bg-zinc-50 focus-visible:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 md:grid md:items-center md:gap-4 md:py-3.5 ${desktopAuditGrid}`}
        >
          <div className="flex min-w-0 items-center gap-3">
            <Avatar className="h-8 w-8 shrink-0 border border-zinc-200">
              <AvatarFallback className="bg-zinc-100 text-xs font-medium text-zinc-600">
                {getInitials(group.actor_name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-col">
              <span className="flex items-center gap-1.5 truncate text-sm font-medium text-zinc-900">
                <span className="truncate">{group.actor_name}</span>
                {mergedCount > 1 && (
                  <span
                    title={`${mergedCount} updates merged`}
                    className="shrink-0 rounded-full bg-zinc-100 px-1.5 py-px text-[11px] font-medium leading-normal text-zinc-500"
                  >
                    ×{mergedCount}
                  </span>
                )}
              </span>
              {actorEmail && (
                <span className="hidden truncate text-xs text-zinc-400 md:block">
                  {actorEmail}
                </span>
              )}
            </div>
          </div>

          <div className="hidden md:block">
            <ActionBadge action={group.action} />
          </div>

          <div className="hidden min-w-0 md:flex md:items-center">
            <EntityBadge entityType={group.entity_type} />
          </div>

          <div className="hidden text-sm text-zinc-500 md:flex md:items-center">
            {changeCount > 0 ? (
              <span className="flex items-center gap-1.5">
                <MoreHorizontal className="h-4 w-4 text-zinc-400 transition-colors group-hover:text-zinc-600" />
                {changeCount} {changeCount === 1 ? "change" : "changes"}
              </span>
            ) : (
              <span className="text-xs italic text-zinc-400">No details</span>
            )}
          </div>

          <div className="hidden items-center justify-end gap-2 md:flex">
            <span className="whitespace-nowrap text-sm tabular-nums text-zinc-500">
              {dateStr}
            </span>
            <ChevronRight className="h-4 w-4 text-zinc-300 transition-colors group-hover:text-zinc-500" />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 md:hidden">
            <ActionBadge action={group.action} />
            <EntityBadge entityType={group.entity_type} />
            <span>
              {changeCount > 0
                ? `${changeCount} ${changeCount === 1 ? "change" : "changes"}`
                : "No details"}
            </span>
            <span className="ml-auto tabular-nums">{dateStr}</span>
          </div>
        </div>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={4}
        className="w-auto rounded-xl border border-zinc-200 bg-white p-0 shadow-xl"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <ChangesDropdown group={group} onClose={() => setIsOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}

// --- Change Card (Split Cards pattern) ---

function ChangeCard({
  field,
  before,
  after,
  action,
}: {
  field: string;
  before: unknown;
  after: unknown;
  action: string;
}) {
  const isUpdate = action === "UPDATE";
  const isDelete = action === "DELETE";

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200">
      <div className="border-b border-zinc-100 bg-zinc-50/80 px-3 py-1.5">
        <span className="text-xs font-semibold text-zinc-500">
          {fieldLabel(field)}
        </span>
        
      </div>

      {isUpdate ? (
        <div className="grid grid-cols-2 divide-x divide-zinc-100">
          <div className="p-2.5">
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-red-400">
              Before
            </div>
            {smartRender(before)}
          </div>
          <div className="p-2.5">
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-emerald-500">
              After
            </div>
            {smartRender(after)}
          </div>
        </div>
      ) : (
        <div className="p-2.5">
          <div
            className={`mb-1.5 text-[10px] font-semibold uppercase tracking-widest ${
              isDelete ? "text-red-400" : "text-emerald-500"
            }`}
          >
            {isDelete ? "Removed" : "Set"}
          </div>
          {smartRender(isDelete ? before : after)}
        </div>
      )}
    </div>
  );
}
