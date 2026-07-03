"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useToast } from "@/components/providers/toast";
import { listAuditLogs } from "@/actions/audit/list";
import { AuditLog } from "@/lib/types/audit-log";
import { Input } from "@/components/ui/input";
import { ChevronDown, ChevronRight, Search, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useParams } from "next/navigation";
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
export default function AuditLogsPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState<string | undefined>();
  const [search, setSearch] = useState("");
  const { addToast } = useToast();

  const loadLogs = useCallback(async (isNewSearch = false) => {
    try {
      const data = await listAuditLogs({
            organizationId: orgId,

            search,

            cursor: isNewSearch
                ? null
                : cursor,

            limit: 25,
        });
      
      setLogs(prev => isNewSearch ? data : [...prev, ...data]);
      setCursor(data.length > 0 ? data[data.length - 1].created_at : undefined);
    } catch {
      addToast("Failed to load audit logs", "error");
    } finally {
      setLoading(false);
    }
  }, [orgId, search, cursor, addToast]);
  const groupedLogs = groupAuditLogs(logs);
  useEffect(() => { loadLogs(true); }, [search]);

  return (
    <div className="flex flex-col gap-6 p-8">
      <div className="sticky top-0 z-10 bg-white pb-4 border-b">
        <h1 className="text-2xl font-semibold mb-4">Audit Logs</h1>
        <Input 
          placeholder="Search logs..." 
          value={search} 
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <div className="rounded-lg border shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 border-b">
            <tr>
              <th className="p-4 text-left">Actor</th>
              <th className="p-4 text-left">Action</th>
              <th className="p-4 text-left">Changes</th>
              <th className="p-4 text-left">Time</th>
            </tr>
          </thead>
          <tbody>
            {groupedLogs.map((group) => (
                <AuditLogGroup
                    key={group.id}
                    group={group}
                />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AuditLogGroup({
    group,
}: {
    group: AuditGroup;
}) {
  const [expanded, setExpanded] = useState(false);
  const actionText = {
  CREATE: "Created",
  UPDATE: "Updated",
  DELETE: "Deleted",
}[group.action] ?? group.action;
  const allChanges = group.logs.flatMap((log) => log.changes);

  return (
    <tr className="border-b hover:bg-zinc-50/50 transition-colors">
      <td className="p-4 font-medium">{group.actor_name}</td>
      <td className="p-4">
        {actionText} {group.entity_type}
      </td>
      <td className="p-4">
        {group.logs.some((log) => log.changes.length > 0) ? (
  <>
    <button
      onClick={() => setExpanded(!expanded)}
      className="flex items-center gap-1 text-indigo-600"
    >
      {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      View {allChanges.length} Changes
    </button>

    {expanded && (
      
          <div className="mt-3 space-y-2 rounded border bg-zinc-50 p-3">
            {allChanges
            .map((change, index) => (
              <div
                key={`${change.field}-${index}`}
                className="flex justify-between gap-6 text-sm"
              >
                <span className="font-medium capitalize">
                  
                  {change.field.replaceAll("_", " ")}
                </span>

                {group.action === "CREATE" && (
                  <span>{String(change.after ?? "-")}</span>
                )}

                {group.action === "DELETE" && (
                  <span>{String(change.before ?? "-")}</span>
                )}

                {group.action === "UPDATE" && (
                  <span>
                    {String(change.before ?? "-")} → {String(change.after ?? "-")}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </>
    ) : (
      <span className="text-zinc-500 italic">No details</span>
    )}
        
      </td>
      <td className="p-4 text-zinc-500">{format(new Date(group.created_at), "PPp")}</td>
    </tr>
  );
}