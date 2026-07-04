import { fail, ok } from "@/lib/api/response";
import { authorize } from "@/lib/auth/authorization";
import { requireTenantContext } from "@/lib/auth/tenant-context";
import { projectCreateSchema, projectListQuerySchema } from "@/lib/validation/project";
import { createProject, listProjects } from "@/services/project/project.service";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createAuditLog } from "@/services/audit/audit.service";

export async function GET(req: Request) {
  const routeStart = Date.now();
  try {
    const tenantStart = Date.now();
    const tenant = await requireTenantContext(req);
    console.info(`[perf] [Fetch] api projects GET requireTenantContext ${Date.now() - tenantStart}ms`);
    authorize("read", "organization", tenant);

    const url = new URL(req.url);
    const query = projectListQuerySchema.parse({
      page: url.searchParams.get("page") ?? undefined,
      size: url.searchParams.get("size") ?? undefined,
    });

    const queryStart = Date.now();
    const result = await listProjects(tenant.supabase, {
      organizationId: tenant.organizationId,
      page: query.page,
      size: query.size,
    });
    console.info(`[perf] [DB] api projects listProjects ${Date.now() - queryStart}ms`);
    console.info(`[perf] [Page] api projects GET total ${Date.now() - routeStart}ms`);

    return ok({
      projects: result.items,
      pagination: {
        page: result.page,
        size: result.size,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  } catch (err) {
    console.info(`[perf] [Page] api projects GET total ${Date.now() - routeStart}ms`);
    console.error("[GET_PROJECTS_EXCEPTION]:", err);
    return fail(err);
  }
}

export async function POST(req: Request) {
  const routeStart = Date.now();
  try {
    const tenantStart = Date.now();
    const tenant = await requireTenantContext(req);
    console.info(`[perf] [Fetch] api projects POST requireTenantContext ${Date.now() - tenantStart}ms`);
    authorize("create", "project", tenant);

    const parseStart = Date.now();
    const payload = projectCreateSchema.parse(await req.json());
    console.info(`[perf] [Compute] api projects POST parse body ${Date.now() - parseStart}ms`);

    const queryStart = Date.now();
    const project = await createProject(tenant.supabase, {
      organizationId: tenant.organizationId,
      name: payload.name,
      status: payload.status,
      startDate: payload.startDate,
      endDate: payload.endDate,
    });
    console.info(`[perf] [DB] api projects createProject ${Date.now() - queryStart}ms`);

    void createAuditLog(supabaseAdmin, {
      organizationId: tenant.organizationId,
      projectId: project.id,
      actorId: tenant.user.id,
      action: "CREATE",
      entityType: "project",
      entityId: project.id,
      changes: [
        {
          field: "title",
          before: null,
          after: project.name,
        },
        {
          field: "description",
          before: null,
          after: null,
        },
        {
          field: "status",
          before: null,
          after: project.status,
        },
        {
          field: "start_date",
          before: null,
          after: project.start_date,
        },
        {
          field: "due_date",
          before: null,
          after: project.end_date,
        },
        {
          field: "members",
          before: null,
          after: [tenant.user.email ?? tenant.user.id],
        },
      ],
    });

    console.info(`[perf] [Page] api projects POST total ${Date.now() - routeStart}ms`);

    return ok(
      {
        message: "Project created",
        project,
      },
      { status: 201 }
    );
  } catch (err) {
    console.info(`[perf] [Page] api projects POST total ${Date.now() - routeStart}ms`);
    console.error("[POST_PROJECT_EXCEPTION]:", err);
    return fail(err);
  }
}
