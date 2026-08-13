import { fail, ok } from "@/lib/api/response";
import { authorize } from "@/lib/auth/authorization";
import { requireTenantContext } from "@/lib/auth/tenant-context";
import { projectIdParamsSchema, projectUpdateSchema } from "@/lib/validation/project";
import { createAuditLog } from "@/services/audit/audit.service";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { softDeleteProject } from "@/services/project/project.service";
import { getProjectById } from "@/services/resource/project.service";
import { updateProject } from "@/services/project/project.service";
import { listProjectMembers as listProjectMembersService } from "@/services/resource/projectMember.service";
import { NextResponse } from "next/server"

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const tenant = await requireTenantContext(req);
    authorize("update", "project", tenant);

    const { projectId } = projectIdParamsSchema.parse(await params);
    const body = projectUpdateSchema.parse(await req.json());

    const [beforeProject, beforeMembers] = await Promise.all([
      getProjectById(tenant.supabase, {
        organizationId: tenant.organizationId,
        projectId,
      }),
      listProjectMembersService(tenant.supabase, {
        organizationId: tenant.organizationId,
        projectId,
      }),
    ]);

    if (!beforeProject) {
      throw new Error("Project not found");
    }

    const project = await updateProject(tenant.supabase, {
      organizationId: tenant.organizationId,
      projectId,
      name: body.name,
      status: body.status,
      startDate: body.startDate,
      endDate: body.endDate,
    });

    const afterMembers = await listProjectMembersService(tenant.supabase, {
      organizationId: tenant.organizationId,
      projectId,
    });

    const changes = [];

    if (beforeProject.name !== project.name) {
      changes.push({
        field: "title",
        before: beforeProject.name,
        after: project.name,
      });
    }

    if (beforeProject.status !== project.status) {
      changes.push({
        field: "status",
        before: beforeProject.status,
        after: project.status,
      });
    }

    if (beforeProject.start_date !== project.start_date) {
      changes.push({
        field: "start_date",
        before: beforeProject.start_date,
        after: project.start_date,
      });
    }

    if (beforeProject.end_date !== project.end_date) {
      changes.push({
        field: "due_date",
        before: beforeProject.end_date,
        after: project.end_date,
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
        organizationId: tenant.organizationId,
        projectId: project.id,
        actorId: tenant.user.id,
        action: "UPDATE",
        entityType: "project",
        entityId: project.id,
        changes,
      });
    }

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
    let tenant;
    try {
      tenant = await requireTenantContext(req);
    } catch (authErr) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      authorize("delete", "project", tenant);
    } catch (authErr) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

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
