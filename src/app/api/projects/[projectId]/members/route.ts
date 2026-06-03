import { fail, ok } from "@/lib/api/response";
import { authorize } from "@/lib/auth/authorization";
import { requireTenantContext } from "@/lib/auth/tenant-context";
import {
  projectIdParamsSchema,
  projectMemberCreateSchema,
} from "@/lib/validation/project";
import {
  addProjectMember,
  listProjectMembers,
} from "@/services/resource/projectMember.service";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const tenant = await requireTenantContext(req);
    authorize("read", "organization", tenant);

    const { projectId } = projectIdParamsSchema.parse(await params);

    const members = await listProjectMembers(tenant.supabase, {
      organizationId: tenant.organizationId,
      projectId,
    });

    return ok({ members });
  } catch (err) {
    console.error("[GET_PROJECT_MEMBERS_EXCEPTION]:", err);
    return fail(err);
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const tenant = await requireTenantContext(req);
    authorize("update", "project", tenant);

    const { projectId } = projectIdParamsSchema.parse(await params);
    const payload = projectMemberCreateSchema.parse(await req.json());

    const member = await addProjectMember(tenant.supabase, {
      organizationId: tenant.organizationId,
      projectId,
      userId: payload.userId,
      role: payload.role,
    });

    return ok(
      {
        message: "Project member added",
        member,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[POST_PROJECT_MEMBER_EXCEPTION]:", err);
    return fail(err);
  }
}
