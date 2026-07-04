import { fail, ok } from "@/lib/api/response";
import { authorize } from "@/lib/auth/authorization";
import { requireTenantContext } from "@/lib/auth/tenant-context";
import {
  projectMemberParamsSchema,
  projectMemberRoleUpdateSchema,
} from "@/lib/validation/project";
import { createAuditLog } from "@/services/audit/audit.service";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  removeProjectMember,
  updateProjectMemberRole,
  listProjectMembers as listProjectMembersService,
} from "@/services/resource/projectMember.service";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ projectId: string; userId: string }> }
) {
  try {
    const tenant = await requireTenantContext(req);
    authorize("update", "project", tenant);

    const { projectId, userId } = projectMemberParamsSchema.parse(await params);
    const payload = projectMemberRoleUpdateSchema.parse(await req.json());

    const member = await updateProjectMemberRole(tenant.supabase, {
      organizationId: tenant.organizationId,
      projectId,
      userId,
      role: payload.role,
    });

    return ok({
      message: "Project member role updated",
      member,
    });
  } catch (err) {
    console.error("[PATCH_PROJECT_MEMBER_EXCEPTION]:", err);
    return fail(err);
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ projectId: string; userId: string }> }
) {
  try {
    const tenant = await requireTenantContext(req);
    authorize("update", "project", tenant);

    const { projectId, userId } = projectMemberParamsSchema.parse(await params);

    const beforeMembers = await listProjectMembersService(tenant.supabase, {
      organizationId: tenant.organizationId,
      projectId,
    });

    await removeProjectMember(tenant.supabase, {
      organizationId: tenant.organizationId,
      projectId,
      userId,
    });

    const afterMembers = await listProjectMembersService(tenant.supabase, {
      organizationId: tenant.organizationId,
      projectId,
    });

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
        organizationId: tenant.organizationId,
        projectId,
        actorId: tenant.user.id,
        action: "UPDATE",
        entityType: "project",
        entityId: projectId,
        changes: [
          {
            field: "members",
            before: beforeMemberLabels,
            after: afterMemberLabels,
          },
        ],
      });
    }

    return ok({ message: "Project member removed" });
  } catch (err) {
    console.error("[DELETE_PROJECT_MEMBER_EXCEPTION]:", err);
    return fail(err);
  }
}
