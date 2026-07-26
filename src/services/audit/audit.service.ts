// services/audit/audit.service.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/types/database";
import { AuditLog } from "@/lib/types/audit-log";
import { ValidationError } from "@/lib/api/errors";

type AuditChange = {
  field: string;
  before: Json;
  after: Json;
};
type CreateAuditLogParams = {
  organizationId: string;
  projectId: string | null;
  actorId: string | null;
  action: "CREATE" | "UPDATE" | "DELETE";
  entityType: "task" | "project" | "member" | "org";
  entityId: string;
  changes?: AuditChange[];
};

/**
 * Insert an audit log row.
 *
 * IMPORTANT:
 * - `supabaseAdmin` MUST be the service-role client (lib/supabase/admin.ts).
 *   RLS on audit_logs blocks client/user-context inserts by design
 *   (audit trail must be system-generated, never user-forgeable).
 * - Never throws. Audit logging is observability, not a business rule —
 *   a failed insert here must never roll back or block the caller's
 *   primary mutation. Failures are logged instead.
 * - For UPDATE actions with an empty `changes` array (no actual field
 *   diff), the insert is skipped entirely to avoid noise. CREATE/DELETE
 *   are always logged since they don't necessarily have a field diff.
 */
export async function createAuditLog(
  supabaseAdmin: SupabaseClient<Database>,
  params: CreateAuditLogParams
): Promise<void> {
  const changes = params.changes ?? [];

  if (params.action === "UPDATE" && changes.length === 0) {
    return;
  }

  const { error } = await supabaseAdmin.from("audit_logs").insert({
    organization_id: params.organizationId,
    project_id: params.projectId,
    actor_id: params.actorId,
    action: params.action,
    entity_type: params.entityType,
    entity_id: params.entityId,
    changes,
  });

  if (error) {
    // Never throw — audit failure must not block the primary mutation.
    console.error("[audit_log_insert_failed]", {
      organizationId: params.organizationId,
      entityType: params.entityType,
      entityId: params.entityId,
      action: params.action,
      error: error.message,
    });
  }
}

export async function fetchAuditLogs(
  supabase: SupabaseClient<Database>,
  params: {
    organizationId: string;
    projectId?: string | null;

    search?: string;
    action?: "CREATE" | "UPDATE" | "DELETE";
    entityType?: "task" | "project" | "member" | "org";
    actorId?: string;
    fromDate?: string;
    toDate?: string;

    sortBy?: "created_at" | "action" | "entity_type";
    sortDirection?: "asc" | "desc";

    cursor?: string | null;
    limit?: number;
  }
): Promise<AuditLog[]> {
  const { data, error } = await supabase.rpc("get_audit_logs", {
    p_organization_id: params.organizationId,
    p_project_id: params.projectId ?? undefined,

    p_search: params.search ?? undefined,
    p_action: params.action ?? undefined,
    p_entity_type: params.entityType,
    p_actor_id: params.actorId ?? undefined,
    p_from_date: params.fromDate ?? undefined,
    p_to_date: params.toDate ?? undefined,

    p_sort_by: params.sortBy ?? "created_at",
    p_sort_dir: params.sortDirection ?? "desc",

    p_cursor: params.cursor ?? undefined,
    p_limit: params.limit ?? 25,
  });

  if (error) {
    throw new ValidationError({
      message: error.message,
      details: error,
    });
  }

  return (data ?? []).map((log) => ({
  ...log,
  changes: log.changes as AuditChange[],
}));
}
