"use server";

import { requireOrgContext } from "@/actions/_helpers/requireOrgContext";
import { fetchAuditLogs } from "@/services/audit/audit.service";
import { uuidSchema } from "@/lib/validation/common";

export async function listAuditLogs(params: {
  organizationId: string;
  projectId?: string | null;

  search?: string;

  action?: "CREATE" | "UPDATE" | "DELETE";

  entityType?: "task" | "project" | "member" | "org";
  actorId?: string;
  fromDate?: string;
  toDate?: string;

  sortBy?: "created_at" | "action" | "entity_type";

  sortOrder?: "asc" | "desc";

  cursor?: string | null;

  limit?: number;
}) {
  const validatedOrgId = uuidSchema.parse(params.organizationId);

  const ctx = await requireOrgContext({
    organizationId: validatedOrgId,
  });

  return fetchAuditLogs(ctx.supabase, {
    organizationId: ctx.organizationId,
    projectId: params.projectId,
    search: params.search,
    action: params.action,
    entityType: params.entityType,
    actorId: params.actorId,
    fromDate: params.fromDate,
    toDate: params.toDate,
    sortBy: params.sortBy,
    sortDirection: params.sortOrder,
    cursor: params.cursor,
    limit: params.limit,
  });
}
