"use server";

import { revalidateTag } from "next/cache";
import { requireOrgContext } from "@/actions/_helpers/requireOrgContext";
import { authorize } from "@/lib/auth/authorization";
import { uuidSchema } from "@/lib/validation/common";
import { createAuditLog } from "@/services/audit/audit.service";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { softDeleteProject } from "@/services/project/project.service";
import { getProjectById } from "@/services/resource/project.service";
import { listProjectMembers as listProjectMembersService } from "@/services/resource/projectMember.service";

export async function deleteProject(projectId: string) {
  const validatedProjectId = uuidSchema.parse(projectId);

  const ctx = await requireOrgContext();
  authorize("delete", "project", { role: ctx.role });

  const [project, members] = await Promise.all([
    getProjectById(ctx.supabase, {
      organizationId: ctx.organizationId,
      projectId: validatedProjectId,
    }),
    listProjectMembersService(ctx.supabase, {
      organizationId: ctx.organizationId,
      projectId: validatedProjectId,
    }),
  ]);

  if (!project) {
    throw new Error("Project not found");
  }

  await softDeleteProject(ctx.supabase, {
    organizationId: ctx.organizationId,
    projectId: validatedProjectId,
  });

  void createAuditLog(supabaseAdmin, {
    organizationId: ctx.organizationId,
    projectId: project.id,
    actorId: ctx.user.id,
    action: "DELETE",
    entityType: "project",
    entityId: project.id,
    changes: [
      {
        field: "title",
        before: project.name,
        after: null,
      },
      {
        field: "description",
        before: null,
        after: null,
      },
      {
        field: "status",
        before: project.status,
        after: null,
      },
      {
        field: "start_date",
        before: project.start_date ?? null,
        after: null,
      },
      {
        field: "due_date",
        before: project.end_date ?? null,
        after: null,
      },
      {
        field: "members",
        before: members.map((member) => member.full_name ?? member.user_id),
        after: null,
      },
    ],
  });

  revalidateTag(`analytics-${ctx.organizationId}`,"default");
}
