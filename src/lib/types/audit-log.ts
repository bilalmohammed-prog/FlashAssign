// app/types/audit-log.ts
import { Json } from "../types/database";
type AuditChange = {
  field: string;
  before: Json;
  after: Json;
};
export interface AuditLog {
  id: string;
  organization_id: string;
  project_id: string | null;
  actor_id: string | null;
  actor_name: string;
  action: string;
  entity_type: string;
  entity_id: string;
  changes: AuditChange[];
  created_at: string;
  total_count: number;
}

// app/services/audit-log.service.ts
import { getSupabaseServer as createClient } from "../supabase/server";

export async function fetchAuditLogs(params: {
  orgId: string;
  projectId?: string;
  search?: string;
  action?: string;
  entityType?: string;
  sortBy?: string;
  sortDir?: string;
  cursor?: string;
  limit?: number;
}) {
  const supabase = await createClient();
  
  const { data, error } = await supabase.rpc("get_audit_logs", {
    p_organization_id: params.orgId,
    p_project_id: params.projectId || undefined,
    p_search: params.search || undefined,
    p_action: params.action || undefined,
    p_entity_type: params.entityType || undefined,
    p_sort_by: params.sortBy || "created_at",
    p_sort_dir: params.sortDir || "desc",
    p_cursor: params.cursor || undefined,
    p_limit: params.limit || 25,
  });

  if (error) throw error;
  const logs = data.map(log => ({
  ...log,
    changes: log.changes as AuditChange[],
  }));

  return logs;
}