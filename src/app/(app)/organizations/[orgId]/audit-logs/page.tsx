"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { format, formatDistanceToNowStrict } from "date-fns";
import { 
  Search, 
  RefreshCw, 
  Download, 
  MoreHorizontal,
  Clock,
  ArrowRight
} from "lucide-react";

import { useToast } from "@/components/providers/toast";
import { listAuditLogs } from "@/actions/audit/list";
import { listOrgMembers } from "@/actions/organization/listOrgMembers";
import { AuditLog } from "@/lib/types/audit-log";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle,
  SheetDescription
} from "@/components/ui/sheet";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { DatePicker } from "@/components/ui/date-picker";

// --- Types & Existing Logic ---

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

const getActionColor = (action: string) => {
  const normalized = action.toUpperCase();
  switch (normalized) {
    case "CREATE": return "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400 hover:bg-green-100";
    case "UPDATE": return "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400 hover:bg-blue-100";
    case "DELETE": return "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400 hover:bg-red-100";
    case "ASSIGN": return "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400 hover:bg-purple-100";
    case "COMPLETE": return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 hover:bg-emerald-100";
    default: return "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 hover:bg-zinc-100";
  }
};

const getInitials = (name: string) => {
  return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || '?';
};

// --- Main Component ---

export default function AuditLogsPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState<string | undefined>();
  const [filters, setFilters] = useState<AuditFilters>({
    search: "",
  });
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const { addToast } = useToast();
  
  // Drawer state
  const [selectedGroup, setSelectedGroup] = useState<AuditGroup | null>(null);

  const loadLogs = useCallback(async (isNewSearch = false, pageCursor?: string) => {
    if (isNewSearch) setLoading(true);
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
        limit: 25,
      });
      
      setLogs(prev => isNewSearch ? data : [...prev, ...data]);
      setCursor(data.length > 0 ? data[data.length - 1].created_at : undefined);
    } catch {
      addToast("Failed to load audit logs", "error");
    } finally {
      setLoading(false);
    }
  }, [orgId, filters, addToast]);

  useEffect(() => {
    let cancelled = false;

    void listOrgMembers(orgId).then((result) => {
      if (!cancelled && result.data) setMembers(result.data);
    });

    return () => { cancelled = true; };
  }, [orgId]);

  const groupedLogs = groupAuditLogs(logs);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      void loadLogs(true);
    }, 300);

    return () => clearTimeout(timer);
  }, [filters, loadLogs]);

  return (
    <div className="flex flex-col h-full w-full max-w-7xl mx-auto p-6 md:p-8 space-y-6 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Audit Logs
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Track user activity, security events, and system changes.
          </p>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="relative w-full flex-1 max-w-xl">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <Input
              placeholder="Search logs..."
              value={filters.search}
              onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
              className="h-9 border-zinc-300 bg-white pl-9 text-sm text-zinc-700 shadow-sm placeholder:text-zinc-500 focus-visible:ring-2 focus-visible:ring-indigo-500"
            />
          </div>

          <select
            value={filters.action ?? "all"}
            onChange={(event) => setFilters((current) => ({ ...current, action: event.target.value === "all" ? undefined : event.target.value as AuditFilters["action"] }))}
            className="h-9 w-full cursor-pointer rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-700 shadow-sm outline-none transition-colors focus:border-transparent focus:ring-2 focus:ring-indigo-500 sm:w-36"
          >
            <option value="all">All actions</option>
            <option value="CREATE">Create</option>
            <option value="UPDATE">Update</option>
            <option value="DELETE">Delete</option>
          </select>

          <select
            value={filters.entityType ?? "all"}
            onChange={(event) => setFilters((current) => ({ ...current, entityType: event.target.value === "all" ? undefined : event.target.value as AuditFilters["entityType"] }))}
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
            onChange={(event) => setFilters((current) => ({ ...current, actor: event.target.value === "all" ? undefined : event.target.value }))}
            className="h-9 w-full cursor-pointer rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-700 shadow-sm outline-none transition-colors focus:border-transparent focus:ring-2 focus:ring-indigo-500 sm:w-44"
          >
            <option value="all">Any user</option>
            {members.map((member) => <option key={member.user_id} value={member.user_id}>{member.name}</option>)}
          </select>

          <div className="flex items-center gap-2">
            <DatePicker
              value={filters.fromDate ?? null}
              onChange={(fromDate) => setFilters((current) => ({ ...current, fromDate: fromDate ?? undefined }))}
              placeholder="From date"
              className="h-9 w-[150px] justify-start border-zinc-300 bg-white px-3 text-sm font-normal shadow-sm hover:bg-white"
            />
            <ArrowRight className="h-4 w-4 text-zinc-400" />
            <DatePicker
              value={filters.toDate ?? null}
              onChange={(toDate) => setFilters((current) => ({ ...current, toDate: toDate ?? undefined }))}
              placeholder="To date"
              className="h-9 w-[150px] justify-start border-zinc-300 bg-white px-3 text-sm font-normal shadow-sm hover:bg-white"
            />
          </div>
        </div>

        <div className="flex w-full items-center gap-2 sm:w-auto">
          <Button variant="outline" size="sm" onClick={() => void loadLogs(true)} className="h-9">
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
          <Button variant="outline" size="sm" className="h-9">
            <Download className="mr-2 h-4 w-4" /> Export
          </Button>
        </div>
      </div>

      {/* Table Container */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-zinc-50 dark:bg-zinc-900/50 sticky top-0 z-10 shadow-sm">
              <TableRow className="border-b border-zinc-200 dark:border-zinc-800 hover:bg-transparent">
                <TableHead className="w-[250px] font-medium text-zinc-500">Actor</TableHead>
                <TableHead className="w-[150px] font-medium text-zinc-500">Action</TableHead>
                <TableHead className="w-[250px] font-medium text-zinc-500">Resource</TableHead>
                <TableHead className="font-medium text-zinc-500">Changes</TableHead>
                <TableHead className="w-[150px] font-medium text-zinc-500 text-right">Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="border-b border-zinc-100 dark:border-zinc-800/50">
                    <TableCell><Skeleton className="h-10 w-full" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-24 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : groupedLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-48 text-center text-zinc-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Search className="h-8 w-8 text-zinc-300 dark:text-zinc-700" />
                      <p>No audit logs found.</p>
                      {(filters.search || filters.action || filters.entityType || filters.actor || filters.fromDate || filters.toDate) && (
                        <Button variant="link" onClick={() => setFilters({ search: "" })}>
                          Clear filters
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                groupedLogs.map((group) => (
                  <AuditLogGroupRow
                    key={group.id}
                    group={group}
                    onClick={() => setSelectedGroup(group)}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Load More Pagination */}
      {!loading && cursor && (
        <div className="flex justify-center pt-4">
          <Button variant="outline" onClick={() => void loadLogs(false, cursor)}>
            Load Older Events
          </Button>
        </div>
      )}

      {/* Details Drawer */}
      <AuditLogDetailsSheet 
        group={selectedGroup} 
        onClose={() => setSelectedGroup(null)} 
      />
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
    <TableRow 
      onClick={onClick}
      className="cursor-pointer group hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors border-b border-zinc-100 dark:border-zinc-800/50"
    >
      <TableCell className="py-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8 border border-zinc-200 dark:border-zinc-800">
            <AvatarFallback className="bg-zinc-100 dark:bg-zinc-800 text-xs font-medium text-zinc-600 dark:text-zinc-300">
              {getInitials(group.actor_name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="font-medium text-sm text-zinc-900 dark:text-zinc-100 truncate max-w-[180px]">
              {group.actor_name}
            </span>
            {group.actor_id && (
              <span className="text-xs text-zinc-500 truncate max-w-[180px] font-mono">
                {group.actor_id}
              </span>
            )}
          </div>
        </div>
      </TableCell>
      
      <TableCell className="py-3">
        <Badge variant="secondary" className={`border-transparent font-medium ${getActionColor(group.action)}`}>
          {group.action}
        </Badge>
      </TableCell>
      
      <TableCell className="py-3">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs text-zinc-600 dark:text-zinc-400 capitalize">
            {group.entity_type}
          </Badge>
        </div>
      </TableCell>
      
      <TableCell className="py-3 text-sm text-zinc-600 dark:text-zinc-400">
        {changeCount > 0 ? (
          <span className="flex items-center gap-1.5">
            <MoreHorizontal className="h-4 w-4 text-zinc-400 group-hover:text-zinc-600 transition-colors" />
            {changeCount} {changeCount === 1 ? "change" : "changes"}
          </span>
        ) : (
          <span className="text-zinc-400 italic text-xs">No details</span>
        )}
      </TableCell>
      
      <TableCell className="py-3 text-right">
        <div 
          className="flex items-center justify-end gap-1.5 text-sm text-zinc-500 dark:text-zinc-400"
          title={exactTime}
        >
          <Clock className="h-3.5 w-3.5 opacity-70" />
          <span className="whitespace-nowrap">{relativeTime}</span>
        </div>
      </TableCell>
    </TableRow>
  );
}

// --- Details Drawer Component ---

function AuditLogDetailsSheet({
  group,
  onClose
}: {
  group: AuditGroup | null;
  onClose: () => void;
}) {
  if (!group) return null;
  
  const allChanges = group.logs.flatMap((log) => log.changes);
  const exactTime = format(new Date(group.created_at), "PPp");

  return (
    <Sheet open={!!group} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto bg-white dark:bg-zinc-950 border-l border-zinc-200 dark:border-zinc-800 p-0">
        
        <div className="p-6 border-b border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/20">
          <SheetHeader>
            <SheetTitle className="text-lg font-semibold flex items-center gap-2">
              Event Details
              <Badge variant="secondary" className={`${getActionColor(group.action)} text-[10px] px-1.5 py-0`}>
                {group.action}
              </Badge>
            </SheetTitle>
            <SheetDescription className="text-zinc-500 dark:text-zinc-400">
              {exactTime}
            </SheetDescription>
          </SheetHeader>
        </div>

        <div className="p-6 space-y-8">
          
          {/* Actor Section */}
          <section className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Actor</h4>
            <div className="flex items-center gap-3 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50">
              <Avatar className="h-10 w-10 border border-zinc-200 dark:border-zinc-800">
                <AvatarFallback className="bg-zinc-100 dark:bg-zinc-800 text-sm font-medium text-zinc-600 dark:text-zinc-300">
                  {getInitials(group.actor_name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col overflow-hidden">
                <span className="font-medium text-sm text-zinc-900 dark:text-zinc-100">
                  {group.actor_name}
                </span>
                <span className="text-xs text-zinc-500 font-mono truncate">
                  {group.actor_id || "System"}
                </span>
              </div>
            </div>
          </section>

          {/* Resource Section */}
          <section className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Resource</h4>
            <div className="grid grid-cols-3 gap-y-3 text-sm">
              <div className="text-zinc-500">Type</div>
              <div className="col-span-2 font-medium capitalize text-zinc-900 dark:text-zinc-100">
                {group.entity_type}
              </div>
              <div className="text-zinc-500">ID</div>
              <div className="col-span-2 font-mono text-xs text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800/50 p-1 rounded w-fit">
                {group.entity_id}
              </div>
            </div>
          </section>

          {/* Changes Section */}
          <section className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Changes ({allChanges.length})
            </h4>
            
            {allChanges.length > 0 ? (
              <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 overflow-hidden">
                <div className="max-h-[300px] overflow-y-auto p-4 custom-scrollbar">
                  {allChanges.map((change, index) => (
                    <div key={index} className="mb-4 last:mb-0">
                      <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2 capitalize border-b border-zinc-200 dark:border-zinc-800 pb-1">
                        {change.field.replaceAll("_", " ")}
                      </div>
                      
                      <div className="font-mono text-xs p-3 rounded-md bg-zinc-950 text-zinc-300 overflow-x-auto shadow-inner">
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
              <div className="p-4 rounded-lg border border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/30 text-center text-sm text-zinc-500">
                No detailed field changes recorded for this event.
              </div>
            )}
          </section>

          {/* Metadata Section */}
          <section className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Metadata</h4>
            <div className="grid grid-cols-3 gap-y-3 text-sm text-zinc-600 dark:text-zinc-400">
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
