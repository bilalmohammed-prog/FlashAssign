"use server";

import { revalidateTag } from "next/cache";
import { createProjectInDb } from "@/lib/api";
import { requireOrgContext } from "@/actions/_helpers/requireOrgContext";
import { authorize } from "@/lib/auth/authorization";
import { projectCreateSchema } from "@/lib/validation/project";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createAuditLog } from "@/services/audit/audit.service";
import { addProjectMember } from "@/services/resource/projectMember.service";
import { uuidSchema } from "@/lib/validation/common";


export async function createProjectAction(params: {
  name: string;
  status?: "active" | "paused" | "archived";
  startDate?: string | null;
  endDate?: string | null;
  memberIds?: string[];
}) {
  const { memberIds = [], ...projectParams } = params;
  const validated = projectCreateSchema.parse(projectParams);
  const validatedMemberIds = Array.from(
    new Set(memberIds.map((memberId) => uuidSchema.parse(memberId)))
  );

  const ctx = await requireOrgContext();
  authorize("create", "project", { role: ctx.role });

  const result = await createProjectInDb(ctx.supabase, {
    organizationId: ctx.organizationId,
    ...validated,
  });

  const memberAssignmentResults = await Promise.allSettled(
    validatedMemberIds.map((userId) =>
      addProjectMember(ctx.supabase, {
        organizationId: ctx.organizationId,
        projectId: result.id,
        userId,
      })
    )
  );
  const assignedMemberIds = validatedMemberIds.filter(
    (_, index) => memberAssignmentResults[index]?.status === "fulfilled"
  );

  const { data: memberProfiles } =
    assignedMemberIds.length > 0
      ? await ctx.supabase
          .from("profiles")
          .select("id,full_name")
          .in("id", assignedMemberIds)
      : { data: [] };
  const memberNameById = new Map(
    (memberProfiles ?? []).map((profile) => [profile.id, profile.full_name])
  );
  const auditMembers =
    assignedMemberIds.length > 0
      ? assignedMemberIds.map((memberId) => memberNameById.get(memberId) ?? memberId)
      : [ctx.user.email ?? ctx.user.id];

  void createAuditLog(supabaseAdmin, {
    organizationId: ctx.organizationId,
    projectId: result.id,
    actorId: ctx.user.id,
    action: "CREATE",
    entityType: "project",
    entityId: result.id,
    changes: [
      {
        field: "title",
        before: null,
        after: result.name,
      },
      {
        field: "status",
        before: null,
        after: result.status,
      },
      {
        field: "start_date",
        before: null,
        after: result.start_date,
      },
      {
        field: "due_date",
        before: null,
        after: result.end_date,
      },
      {
        field: "members",
        before: null,
        after: auditMembers,
      },
    ],
  });

  revalidateTag(`analytics-${ctx.organizationId}`,"default");

  return {
    ...result,
    assignedMemberCount: assignedMemberIds.length,
    failedMemberCount: memberAssignmentResults.length - assignedMemberIds.length,
  };
}
