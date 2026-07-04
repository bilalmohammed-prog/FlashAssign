import { fail, ok } from "@/lib/api/response";
import { authorize } from "@/lib/auth/authorization";
import { requireTenantContext } from "@/lib/auth/tenant-context";
import { projectIdParamsSchema, projectUpdateSchema } from "@/lib/validation/project";
import { createAuditLog } from "@/services/audit/audit.service";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  softDeleteProject,
  updateProject,
} from "@/services/project/project.service";
import { getProjectById } from "@/services/resource/project.service";
import { listProjectMembers as listProjectMembersService } from "@/services/resource/projectMember.service";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const tenant = await requireTenantContext(req);
    authorize("update", "project", tenant);

    const { projectId } = projectIdParamsSchema.parse(await params);
    const body = projectUpdateSchema.parse(await req.json());

    const project = await updateProject(tenant.supabase, {
      organizationId: tenant.organizationId,
      projectId,
      name: body.name,
      status: body.status,
      startDate: body.startDate,
      endDate: body.endDate,
    });

    return ok({
      message: "Project updated",
      project,
    });
  } catch (err) {
    console.error("[PATCH_PROJECT_EXCEPTION]:", err);
    return fail(err);
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const tenant = await requireTenantContext(req);
    authorize("delete", "project", tenant);

    const { projectId } = projectIdParamsSchema.parse(await params);

    const [project, members] = await Promise.all([
      getProjectById(tenant.supabase, {
        organizationId: tenant.organizationId,
        projectId,
      }),
      listProjectMembersService(tenant.supabase, {
        organizationId: tenant.organizationId,
        projectId,
      }),
    ]);

    if (!project) {
      throw new Error("Project not found");
    }

    await softDeleteProject(tenant.supabase, {
      organizationId: tenant.organizationId,
      projectId,
    });

    void createAuditLog(supabaseAdmin, {
      organizationId: tenant.organizationId,
      projectId: project.id,
      actorId: tenant.user.id,
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

    return ok({ message: "Project deleted successfully" });
  } catch (err) {
    console.error("[DELETE_PROJECT_EXCEPTION]:", err);
    return fail(err);
  }
}
