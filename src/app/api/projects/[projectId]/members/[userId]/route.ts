import { fail, ok } from "@/lib/api/response";
import { authorize } from "@/lib/auth/authorization";
import { requireTenantContext } from "@/lib/auth/tenant-context";
import {
  projectMemberParamsSchema,
  projectMemberRoleUpdateSchema,
} from "@/lib/validation/project";
import {
  removeProjectMember,
  updateProjectMemberRole,
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

    await removeProjectMember(tenant.supabase, {
      organizationId: tenant.organizationId,
      projectId,
      userId,
    });

    return ok({ message: "Project member removed" });
  } catch (err) {
    console.error("[DELETE_PROJECT_MEMBER_EXCEPTION]:", err);
    return fail(err);
  }
}
