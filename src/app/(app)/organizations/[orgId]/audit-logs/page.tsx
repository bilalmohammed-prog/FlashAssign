"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams } from "next/navigation";
import { format, formatDistanceToNowStrict } from "date-fns";
import {
  Search,
  MoreHorizontal,
  Clock,
  ArrowRight,
  ChevronRight,
  ClipboardList,
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { DatePicker } from "@/components/ui/date-picker";

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

const desktopAuditGrid =
  "md:grid-cols-[minmax(0,1.6fr)_130px_170px_1fr_150px]";

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

function getActionBadgeClass(action: string) {
  switch (action.toUpperCase()) {
    case "CREATE":
      return "bg-emerald-50 text-emerald-700 border-emerald-200/60";
    case "UPDATE":
      return "bg-indigo-50 text-indigo-700 border-indigo-200/60";
    case "DELETE":
      return "bg-red-50 text-red-700 border-red-200/60";
    case "ASSIGN":
      return "bg-purple-50 text-purple-700 border-purple-200/60";
    case "COMPLETE":
      return "bg-emerald-50 text-emerald-700 border-emerald-200/60";
    default:
      return "bg-zinc-100 text-zinc-700 border-zinc-200/60";
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

// --- Main Component ---

export default function AuditLogsPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const { addToast } = useToast();

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<AuditGroup | null>(null);
  const [headingGone, setHeadingGone] = useState(false);

  const [filters, setFilters] = useState<AuditFilters>({ search: "" });

  const cursorRef = useRef<string | undefined>(undefined);
  const hasMoreRef = useRef(false);
  const loadingMoreRef = useRef(false);
  const initialLoadingRef = useRef(true);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const headingRef = useRef<HTMLDivElement>(null);
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
    let cancelled = false;
    void listOrgMembers(orgId).then((result) => {
      if (!cancelled && result.data) setMembers(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  const loadLogs = useCallback(
    async (isNewSearch: boolean, pageCursor?: string) => {
      if (!isNewSearch && loadingMoreRef.current) return;
      if (!orgId) return;

      if (isNewSearch) {
        initialLoadingRef.current = true;
        setInitialLoading(true);
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

  const hasActiveFilters = Boolean(
    filters.search ||
      filters.action ||
      filters.entityType ||
      filters.actor ||
      filters.fromDate ||
      filters.toDate
  );

  const auditToolbar = (
    <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative w-full flex-1 max-w-xl">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input
            placeholder="Search logs"
            value={filters.search}
            onChange={(e) =>
              setFilters((current) => ({ ...current, search: e.target.value }))
            }
            className="h-9 border-zinc-300 bg-white pl-9 text-sm text-zinc-700 placeholder:text-zinc-500 shadow-sm focus-visible:ring-2 focus-visible:ring-indigo-500"
          />
        </div>

        <select
          value={filters.action ?? "all"}
          onChange={(e) =>
            setFilters((current) => ({
              ...current,
              action:
                e.target.value === "all"
                  ? undefined
                  : (e.target.value as AuditFilters["action"]),
            }))
          }
          className="h-9 w-full cursor-pointer rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-700 shadow-sm outline-none transition-colors focus:border-transparent focus:ring-2 focus:ring-indigo-500 sm:w-36"
        >
          <option value="all">All actions</option>
          <option value="CREATE">Create</option>
          <option value="UPDATE">Update</option>
          <option value="DELETE">Delete</option>
        </select>

        <select
          value={filters.entityType ?? "all"}
          onChange={(e) =>
            setFilters((current) => ({
              ...current,
              entityType:
                e.target.value === "all"
                  ? undefined
                  : (e.target.value as AuditFilters["entityType"]),
            }))
          }
          className="h-9 w-full cursor-pointer rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-700 shadow-sm outline-none transition-colors focus:border-transparent focus:ring-2 focus:ring-indigo-500 sm:w-40"
        >
          <option value="all">Any resource</option>
          <option value="task">Task</option>
          <option value="project">Project</option>
          <option value="member">Member</option>
          <option value="org">Organization</option>
        </select>

        <select
          value={filters.actor ?? "all"}
          onChange={(e) =>
            setFilters((current) => ({
              ...current,
              actor: e.target.value === "all" ? undefined : e.target.value,
            }))
          }
          className="h-9 w-full cursor-pointer rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-700 shadow-sm outline-none transition-colors focus:border-transparent focus:ring-2 focus:ring-indigo-500 sm:w-44"
        >
          <option value="all">Any user</option>
          {members.map((member) => (
            <option key={member.user_id} value={member.user_id}>
              {member.name}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-2">
          <DatePicker
            value={filters.fromDate ?? null}
            onChange={(fromDate) =>
              setFilters((current) => ({ ...current, fromDate: fromDate ?? undefined }))
            }
            placeholder="From date"
            className="h-9 w-[150px] justify-start border-zinc-300 bg-white px-3 text-sm font-normal shadow-sm hover:bg-white"
          />
          <ArrowRight className="h-4 w-4 shrink-0 text-zinc-400" />
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
          <div className="flex items-center justify-between gap-4 rounded-t-lg border-b border-zinc-300 bg-zinc-200/80 px-4 py-3 overflow-hidden">
            <div className="flex-1">{auditToolbar}</div>
          </div>

          <div className="flex items-center justify-between border-b border-zinc-300 bg-zinc-200/80 px-6 py-2">
            <p className="text-[12px] text-zinc-600">
              Showing <span className="font-medium text-zinc-600">{logs.length}</span>{" "}
              event{logs.length === 1 ? "" : "s"}
            </p>
          </div>

          <div
            className={`hidden items-center gap-4 border-b border-zinc-200 bg-zinc-200/80 px-6 py-3 text-[13px] font-medium uppercase tracking-wider text-zinc-500 md:grid ${desktopAuditGrid}`}
          >
            <div>Actor</div>
            <div>Action</div>
            <div>Resource</div>
            <div>Changes</div>
            <div className="text-right">Time</div>
          </div>
        </div>

        {!initialLoading && groupedLogs.length === 0 ? (
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
                onClick={() => setFilters({ search: "" })}
                className="h-9 px-4 text-sm font-medium"
              >
                Clear filters
              </Button>
            )}
          </div>
        ) : (
          <div className="w-full overflow-hidden rounded-b-xl border border-t-0 border-zinc-200 bg-white shadow-sm">
            <div
              className={`divide-y divide-zinc-100 ${
                initialLoading ? "opacity-40 pointer-events-none" : ""
              }`}
            >
              {initialLoading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={i}
                      className={`flex flex-col gap-3 px-4 py-4 md:grid md:items-center md:gap-4 md:px-6 md:py-3.5 ${desktopAuditGrid}`}
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
                      onClick={() => setSelectedGroup(group)}
                    />
                  ))}
            </div>

            <div ref={sentinelRef} className="h-4 w-full bg-transparent" />

            {loadingMore && (
              <div className="flex items-center justify-center border-t border-zinc-100 bg-zinc-50/50 py-4 text-xs font-medium text-zinc-500">
                <span className="animate-pulse">Loading older events...</span>
              </div>
            )}
          </div>
        )}
      </div>

      <AuditLogDetailsSheet group={selectedGroup} onClose={() => setSelectedGroup(null)} />
    </div>
  );
}

// --- Row Component ---

function AuditLogGroupRow({
  group,
  onClick,
}: {
  group: AuditGroup;
  onClick: () => void;
}) {
  const allChanges = group.logs.flatMap((log) => log.changes);
  const changeCount = allChanges.length;

  const timestamp = new Date(group.created_at);
  const relativeTime = formatDistanceToNowStrict(timestamp, { addSuffix: true });
  const exactTime = format(timestamp, "PPp");

  return (
    <div
      onClick={onClick}
      className={`group flex cursor-pointer flex-col gap-3 px-4 py-4 transition-colors hover:bg-zinc-50 md:grid md:items-center md:gap-4 md:px-6 md:py-3.5 ${desktopAuditGrid}`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <Avatar className="h-8 w-8 shrink-0 border border-zinc-200">
          <AvatarFallback className="bg-zinc-100 text-xs font-medium text-zinc-600">
            {getInitials(group.actor_name)}
          </AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-[15px] font-medium text-zinc-900">
            {group.actor_name}
          </span>
          {group.actor_id && (
            <span className="hidden truncate font-mono text-xs text-zinc-400 md:block">
              {group.actor_id}
            </span>
          )}
        </div>
      </div>

      <div className="hidden md:block">
        <span
          className={`inline-flex rounded border px-2 py-0.5 text-xs font-medium ${getActionBadgeClass(
            group.action
          )}`}
        >
          {group.action}
        </span>
      </div>

      <div className="hidden min-w-0 md:flex md:items-center">
        <span className="truncate rounded border border-zinc-200 px-2 py-0.5 text-xs font-medium capitalize text-zinc-600">
          {group.entity_type}
        </span>
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
        <div
          className="flex items-center gap-1.5 whitespace-nowrap text-sm text-zinc-500"
          title={exactTime}
        >
          <Clock className="h-3.5 w-3.5 opacity-70" />
          {relativeTime}
        </div>
        <ChevronRight className="h-4 w-4 text-zinc-300 transition-colors group-hover:text-zinc-500" />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 md:hidden">
        <span
          className={`rounded border px-2 py-0.5 text-xs font-medium ${getActionBadgeClass(
            group.action
          )}`}
        >
          {group.action}
        </span>
        <span className="rounded border border-zinc-200 px-2 py-0.5 text-xs font-medium capitalize text-zinc-600">
          {group.entity_type}
        </span>
        <span>{changeCount > 0 ? `${changeCount} ${changeCount === 1 ? "change" : "changes"}` : "No details"}</span>
        <span className="ml-auto flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {relativeTime}
        </span>
      </div>
    </div>
  );
}

// --- Details Drawer Component ---

function AuditLogDetailsSheet({
  group,
  onClose,
}: {
  group: AuditGroup | null;
  onClose: () => void;
}) {
  if (!group) return null;

  const allChanges = group.logs.flatMap((log) => log.changes);
  const exactTime = format(new Date(group.created_at), "PPp");

  return (
    <Sheet open={!!group} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto border-l border-zinc-200 bg-white p-0 sm:max-w-md">
        <div className="border-b border-zinc-200 bg-zinc-50/80 p-6">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2 text-lg font-semibold text-zinc-900">
              Event details
              <span
                className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${getActionBadgeClass(
                  group.action
                )}`}
              >
                {group.action}
              </span>
            </SheetTitle>
            <SheetDescription className="text-zinc-500">{exactTime}</SheetDescription>
          </SheetHeader>
        </div>

        <div className="space-y-8 p-6">
          <section className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Actor
            </h4>
            <div className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white p-3">
              <Avatar className="h-10 w-10 border border-zinc-200">
                <AvatarFallback className="bg-zinc-100 text-sm font-medium text-zinc-600">
                  {getInitials(group.actor_name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-col">
                <span className="text-sm font-medium text-zinc-900">{group.actor_name}</span>
                <span className="truncate font-mono text-xs text-zinc-500">
                  {group.actor_id || "System"}
                </span>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Resource
            </h4>
            <div className="grid grid-cols-3 gap-y-3 text-sm">
              <div className="text-zinc-500">Type</div>
              <div className="col-span-2 font-medium capitalize text-zinc-900">
                {group.entity_type}
              </div>
              <div className="text-zinc-500">ID</div>
              <div className="col-span-2 w-fit rounded bg-zinc-100 p-1 font-mono text-xs text-zinc-700">
                {group.entity_id}
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Changes ({allChanges.length})
            </h4>

            {allChanges.length > 0 ? (
              <div className="overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50">
                <div className="max-h-[300px] overflow-y-auto p-4">
                  {allChanges.map((change, index) => (
                    <div key={index} className="mb-4 last:mb-0">
                      <div className="mb-2 border-b border-zinc-200 pb-1 text-xs font-semibold capitalize text-zinc-700">
                        {change.field.replaceAll("_", " ")}
                      </div>

                      <div className="overflow-x-auto rounded-md bg-zinc-950 p-3 font-mono text-xs text-zinc-300 shadow-inner">
                        {group.action === "CREATE" && (
                          <div className="text-emerald-400">
                            + {JSON.stringify(change.after, null, 2)}
                          </div>
                        )}
                        {group.action === "DELETE" && (
                          <div className="text-rose-400">
                            - {JSON.stringify(change.before, null, 2)}
                          </div>
                        )}
                        {group.action === "UPDATE" && (
                          <div className="flex flex-col gap-2">
                            <div className="text-rose-400 opacity-80">
                              - {JSON.stringify(change.before, null, 2)}
                            </div>
                            <div className="text-emerald-400">
                              + {JSON.stringify(change.after, null, 2)}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50/60 p-4 text-center text-sm text-zinc-500">
                No detailed field changes recorded for this event.
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Metadata
            </h4>
            <div className="grid grid-cols-3 gap-y-3 text-sm text-zinc-600">
              <div className="text-zinc-500">Event ID</div>
              <div className="col-span-2 font-mono text-xs">{group.id}</div>
              <div className="text-zinc-500">Timestamp</div>
              <div className="col-span-2">{exactTime}</div>
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}