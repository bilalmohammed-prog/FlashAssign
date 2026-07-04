"use server";

import { requireOrgContext } from "@/actions/_helpers/requireOrgContext";
import { authorize } from "@/lib/auth/authorization";
import { uuidSchema } from "@/lib/validation/common";
import { projectUpdateSchema } from "@/lib/validation/project";
import { createAuditLog } from "@/services/audit/audit.service";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getProjectById } from "@/services/resource/project.service";
import { updateProject } from "@/services/project/project.service";
import { listProjectMembers as listProjectMembersService } from "@/services/resource/projectMember.service";

export async function updateProjectAction(
  projectId: string,
  params: {
    name?: string;
    status?: "active" | "paused" | "archived";
    startDate?: string | null;
    endDate?: string | null;
  }
) {
  const validatedProjectId = uuidSchema.parse(projectId);
  const validatedParams = projectUpdateSchema.parse(params);

  const ctx = await requireOrgContext();
  authorize("update", "project", { role: ctx.role });

  const [beforeProject, beforeMembers] = await Promise.all([
    getProjectById(ctx.supabase, {
      organizationId: ctx.organizationId,
      projectId: validatedProjectId,
    }),
    listProjectMembersService(ctx.supabase, {
      organizationId: ctx.organizationId,
      projectId: validatedProjectId,
    }),
  ]);

  if (!beforeProject) {
    throw new Error("Project not found");
  }

  const updatedProject = await updateProject(ctx.supabase, {
    organizationId: ctx.organizationId,
    projectId: validatedProjectId,
    name: validatedParams.name,
    status: validatedParams.status,
    startDate: validatedParams.startDate,
    endDate: validatedParams.endDate,
  });

  const afterMembers = await listProjectMembersService(ctx.supabase, {
    organizationId: ctx.organizationId,
    projectId: validatedProjectId,
  });

  const changes = [];

  if (beforeProject.name !== updatedProject.name) {
    changes.push({
      field: "title",
      before: beforeProject.name,
      after: updatedProject.name,
    });
  }

  if (beforeProject.status !== updatedProject.status) {
    changes.push({
      field: "status",
      before: beforeProject.status,
      after: updatedProject.status,
    });
  }

  if (beforeProject.start_date !== updatedProject.start_date) {
    changes.push({
      field: "start_date",
      before: beforeProject.start_date,
      after: updatedProject.start_date,
    });
  }

  if (beforeProject.end_date !== updatedProject.end_date) {
    changes.push({
      field: "due_date",
      before: beforeProject.end_date,
      after: updatedProject.end_date,
    });
  }

  const beforeMemberIds = beforeMembers.map((member) => member.user_id).sort();
  const afterMemberIds = afterMembers.map((member) => member.user_id).sort();
  if (JSON.stringify(beforeMemberIds) !== JSON.stringify(afterMemberIds)) {
    const beforeMemberLabels = [...beforeMembers]
      .sort((a, b) => a.user_id.localeCompare(b.user_id))
      .map((member) => member.full_name ?? member.user_id);
    const afterMemberLabels = [...afterMembers]
      .sort((a, b) => a.user_id.localeCompare(b.user_id))
      .map((member) => member.full_name ?? member.user_id);

    changes.push({
      field: "members",
      before: beforeMemberLabels,
      after: afterMemberLabels,
    });
  }

  if (changes.length > 0) {
    void createAuditLog(supabaseAdmin, {
      organizationId: ctx.organizationId,
      projectId: updatedProject.id,
      actorId: ctx.user.id,
      action: "UPDATE",
      entityType: "project",
      entityId: updatedProject.id,
      changes,
    });
  }

  return updatedProject;
}
