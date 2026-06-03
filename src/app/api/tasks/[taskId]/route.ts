import { ValidationError } from "@/lib/api/errors";
import { fail, ok } from "@/lib/api/response";
import { requireTenantContext } from "@/lib/auth/tenant-context";
import { authorize } from "@/lib/auth/authorization";
import { authorizeTaskUpdate } from "@/lib/auth/task-authorization";
import { toLegacyTaskStatus } from "@/lib/validation/common";
import {
  normalizeTaskUpdateStatus,
  taskIdParamsSchema,
  taskUpdateSchema,
} from "@/lib/validation/task";
import { listAssignments } from "@/services/resource/assignment.service";
import { getProjectById } from "@/services/resource/project.service";
import { deleteTask as deleteTaskService, getTaskById } from "@/services/task/task.service";

/* ---------- TYPES ---------- */
interface TaskTableUpdate {
  title?: string;
  description?: string;
  due_date?: string;
  status?: "todo" | "in_progress" | "blocked" | "done";
}

/* ================= PATCH ================= */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const routeStart = Date.now();
  try {
    const tenantStart = Date.now();
    const tenant = await requireTenantContext(req);
    console.info(`[perf] [Fetch] api task PATCH requireTenantContext ${Date.now() - tenantStart}ms`);
    const { supabase, organizationId, userId, role } = tenant;

    const { taskId } = taskIdParamsSchema.parse(await params);
    const parseStart = Date.now();
    const body = taskUpdateSchema.parse(await req.json());
    console.info(`[perf] [Compute] api task PATCH parse body ${Date.now() - parseStart}ms`);

    const taskStart = Date.now();
    const task = await getTaskById(supabase, { organizationId, taskId });
    console.info(`[perf] [DB] api task PATCH getTaskById ${Date.now() - taskStart}ms`);

    if (!task) {
      throw new ValidationError({ message: "Task not found in your organization" });
    }

    const assignmentsStart = Date.now();
    const assignments = await listAssignments(supabase, {
      organizationId,
      taskId,
    });
    console.info(`[perf] [DB] api task PATCH listAssignments ${Date.now() - assignmentsStart}ms`);
    const assigneeUserId = assignments[0]?.user_id ?? null;

    const normalizedStatus = normalizeTaskUpdateStatus(body.status);
    authorizeTaskUpdate(role, {
      userId,
      assigneeUserId,
      updates: {
        title: body.title,
        description: body.description,
        due_date: body.dueDate,
        status: normalizedStatus,
      },
    });

    if (task.project_id) {
      // POTENTIAL WATERFALL
      const projectStart = Date.now();
      const project = await getProjectById(supabase, {
        organizationId,
        projectId: task.project_id,
      });
      console.info(`[perf] [DB] api task PATCH getProjectById ${Date.now() - projectStart}ms`);

      if (!project) {
        throw new ValidationError({
          message: "Task has an invalid project for this organization",
        });
      }
    }

    const updatePayload: TaskTableUpdate = {};

    if (body.title !== undefined) updatePayload.title = body.title;
    if (body.description !== undefined)
      updatePayload.description = body.description;
    if (body.dueDate !== undefined) updatePayload.due_date = body.dueDate;
    if (normalizedStatus !== undefined) updatePayload.status = normalizedStatus;

    const updateStart = Date.now();
    const { data, error } = await supabase
      .from("tasks")
      .update(updatePayload)
      .eq("id", taskId)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .select()
      .maybeSingle();
    console.info(`[perf] [DB] api task PATCH update task ${Date.now() - updateStart}ms`);

    if (error) {
      throw new ValidationError({ message: error.message, details: error });
    }
    if (!data) {
      throw new ValidationError({ message: "Task not found in your organization" });
    }

    const assignment = assignments[0];
    console.info(`[perf] [Page] api task PATCH total ${Date.now() - routeStart}ms`);

    return ok(
      {
        task: data
          ? {
              employee_id: assignment?.user_id ?? "",
              id: data.id,
              task: data.title,
              description: data.description ?? "",
              startTime: null,
              endTime: data.due_date,
              status: toLegacyTaskStatus(data.status),
              proof: "",
            }
          : null,
      },
      { status: 200 }
    );
  } catch (err) {
    console.info(`[perf] [Page] api task PATCH total ${Date.now() - routeStart}ms`);
    console.error("[PATCH_TASK_EXCEPTION]:", err);
    return fail(err);
  }
}

/* ================= DELETE ================= */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const routeStart = Date.now();
  try {
    const tenantStart = Date.now();
    const tenant = await requireTenantContext(req);
    console.info(`[perf] [Fetch] api task DELETE requireTenantContext ${Date.now() - tenantStart}ms`);
    const { supabase, organizationId } = tenant;
    authorize("delete", "task", tenant);

    const { taskId } = taskIdParamsSchema.parse(await params);

    const deleteStart = Date.now();
    await deleteTaskService(supabase, { organizationId, taskId });
    console.info(`[perf] [DB] api task DELETE deleteTask ${Date.now() - deleteStart}ms`);
    console.info(`[perf] [Page] api task DELETE total ${Date.now() - routeStart}ms`);

    return ok({ message: "Task deleted successfully" }, { status: 200 });
  } catch (err) {
    console.info(`[perf] [Page] api task DELETE total ${Date.now() - routeStart}ms`);
    console.error("[DELETE_TASK_EXCEPTION]:", err);
    return fail(err);
  }
}
