"use server";

import { requireOrgContext } from "@/actions/_helpers/requireOrgContext";
import { authorize } from "@/lib/auth/authorization";
import { getTasksByProject } from "@/services/task/task.service";
import { deleteAssignment, listAssignments } from "@/services/resource/assignment.service";
import {
  removeProjectMember as removeProjectMemberService,
  listProjectMembers as listProjectMembersService,
} from "@/services/resource/projectMember.service";
import { createAuditLog } from "@/services/audit/audit.service";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { uuidSchema } from "@/lib/validation/common";

export async function removeProjectMember(projectId: string, userId: string) {
  const validatedProjectId = uuidSchema.parse(projectId);
  const validatedUserId = uuidSchema.parse(userId);

  const ctx = await requireOrgContext();
  authorize("update", "project", { role: ctx.role });

  const beforeMembers = await listProjectMembersService(ctx.supabase, {
    organizationId: ctx.organizationId,
    projectId: validatedProjectId,
  });

  await removeProjectMemberService(ctx.supabase, {
    organizationId: ctx.organizationId,
    projectId: validatedProjectId,
    userId: validatedUserId,
  });

  const afterMembers = await listProjectMembersService(ctx.supabase, {
    organizationId: ctx.organizationId,
    projectId: validatedProjectId,
  });

  const tasks = await getTasksByProject(ctx.supabase, {
    organizationId: ctx.organizationId,
    projectId: validatedProjectId,
  });

  for (const task of tasks) {
    const assignments = await listAssignments(ctx.supabase, {
      organizationId: ctx.organizationId,
      taskId: task.id,
      userId: validatedUserId,
    });

    for (const assignment of assignments) {
      await deleteAssignment(ctx.supabase, {
        organizationId: ctx.organizationId,
        assignmentId: assignment.id,
      });
    }
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

    void createAuditLog(supabaseAdmin, {
      organizationId: ctx.organizationId,
      projectId: validatedProjectId,
      actorId: ctx.user.id,
      action: "UPDATE",
      entityType: "project",
      entityId: validatedProjectId,
      changes: [
        {
          field: "members",
          before: beforeMemberLabels,
          after: afterMemberLabels,
        },
      ],
    });
  }
}
