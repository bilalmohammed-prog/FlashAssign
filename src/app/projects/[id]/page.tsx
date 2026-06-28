import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireOrgContext } from "@/actions/_helpers/requireOrgContext";
import { createTask } from "@/actions/task/create";
import { assignTaskToResource } from "@/actions/task/assign";
import { assignProjectMember } from "@/actions/project/assignProjectMember";
import { getProjectById } from "@/services/resource/project.service";
import { getTasksByProject } from "@/services/task/task.service";
import { listAssignments } from "@/services/resource/assignment.service";
import { listProjectMembers } from "@/services/resource/projectMember.service";
import { listOrganizationMembers } from "@/services/organization/organization.service";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type ProjectPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ProjectDetailPage({ params }: ProjectPageProps) {
  console.time("[perf] [Page] legacy project detail total");
  const { id: projectId } = await params;
  console.time("[perf] [Fetch] legacy project detail requireOrgContext");
  const ctx = await requireOrgContext();
  console.timeEnd("[perf] [Fetch] legacy project detail requireOrgContext");

  // POTENTIAL WATERFALL
  console.time("[perf] [DB] legacy project detail project query");
  const project = await getProjectById(ctx.supabase, {
    organizationId: ctx.organizationId,
    projectId,
  });
  console.timeEnd("[perf] [DB] legacy project detail project query");
  if (!project) notFound();

  console.time("[perf] [Fetch] legacy project detail related queries");
  const [tasks, assignmentRows, projectMembers, orgMembers] = await Promise.all([
    getTasksByProject(ctx.supabase, { organizationId: ctx.organizationId, projectId }),
    listAssignments(ctx.supabase, { organizationId: ctx.organizationId }),
    listProjectMembers(ctx.supabase, { organizationId: ctx.organizationId, projectId }),
    listOrganizationMembers(ctx.supabase, { organizationId: ctx.organizationId }),
  ]);
  console.timeEnd("[perf] [Fetch] legacy project detail related queries");

  console.time("[perf] [Compute] legacy project detail assignment map");
  const assignmentByTaskId = new Map<string, { userId: string; name: string | null }>();
  for (const row of assignmentRows) {
    if (!assignmentByTaskId.has(row.task_id) && row.task) {
      assignmentByTaskId.set(row.task_id, {
        userId: row.user_id,
        name: row.profile?.name ?? null,
      });
    }
  }
  console.timeEnd("[perf] [Compute] legacy project detail assignment map");

  console.timeEnd("[perf] [Page] legacy project detail total");

  async function createTaskMutation(formData: FormData) {
    "use server";
    const title = String(formData.get("title") ?? "").trim();
    const startDate = String(formData.get("startDate") ?? "");
    const dueDate = String(formData.get("dueDate") ?? "");
    const description = String(formData.get("description") ?? "");
    if (!title) return;

    const orgCtx = await requireOrgContext();
    await createTask(
      title,
      description || undefined,
      startDate || null,
      dueDate || null,
      orgCtx.organizationId,
      projectId
    );
    revalidatePath(`/projects/${projectId}`);
    revalidatePath("/projects");
    revalidatePath("/dashboard");
  }

  async function assignTaskMutation(formData: FormData) {
    "use server";
    const taskId = String(formData.get("taskId") ?? "");
    const assignee = String(formData.get("assignee") ?? "");
    if (!taskId) return;

    await assignTaskToResource(taskId, assignee || null);
    revalidatePath(`/projects/${projectId}`);
    revalidatePath(`/tasks/${taskId}`);
  }

  async function addProjectMemberMutation(formData: FormData) {
    "use server";
    const userId = String(formData.get("userId") ?? "");
    if (!userId) return;

    const orgCtx = await requireOrgContext();
    await assignProjectMember(projectId, userId, orgCtx.organizationId);
    revalidatePath(`/projects/${projectId}`);
    revalidatePath("/projects");
  }

  return (
    <div className="w-full max-w-6xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">{project.name}</h1>
          <p className="text-sm text-muted-foreground">Project workspace and task assignment board.</p>
        </div>
        <Badge variant="secondary">{project.status ?? "active"}</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create Task</CardTitle>
          <CardDescription>Add a new task to this project.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createTaskMutation} className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <Input name="title" placeholder="Task title" required className="md:col-span-2" />
            <Input type="date" name="startDate" />
            <Input type="date" name="dueDate" />
            <Input name="description" placeholder="Description (optional)" />
            <div className="md:col-span-4">
              <Button type="submit">Create Task</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Project Members</CardTitle>
          <CardDescription>Members available for assignment in this project.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {projectMembers.map((member) => (
              <Badge key={member.id} variant="outline">
                {member.full_name ?? member.user_id}
              </Badge>
            ))}
            {projectMembers.length === 0 && (
              <p className="text-sm text-muted-foreground">No project members yet.</p>
            )}
          </div>
          <form action={addProjectMemberMutation} className="flex flex-col gap-3 sm:flex-row">
            <select
              name="userId"
              defaultValue=""
              required
              className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
            >
              <option value="" disabled>
                Select org member
              </option>
              {orgMembers.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.fullName}
                </option>
              ))}
            </select>
            <Button type="submit">Add to Project</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tasks</CardTitle>
          <CardDescription>Manage tasks and assignment status.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tasks in this project.</p>
          ) : (
            tasks.map((task) => {
              const assignee = assignmentByTaskId.get(task.id);
              return (
                <div key={task.id} className="space-y-2 rounded-md border border-border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{task.title}</p>
                      <p className="text-xs text-muted-foreground">Task ID: {task.id}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{task.status ?? "todo"}</Badge>
                      <a href={`/tasks/${task.id}`} className="text-sm underline">
                        Open
                      </a>
                    </div>
                  </div>
                  <form action={assignTaskMutation} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <input type="hidden" name="taskId" value={task.id} />
                    <select
                      name="assignee"
                      defaultValue={assignee?.userId ?? ""}
                      className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                    >
                      <option value="">Unassigned</option>
                      {projectMembers.map((member) => (
                        <option key={member.id} value={member.user_id}>
                          {member.full_name ?? member.user_id}
                        </option>
                      ))}
                    </select>
                    <Button type="submit">Update Assignment</Button>
                  </form>
                  <p className="text-xs text-muted-foreground">
                    Current assignee: {assignee?.name ?? "Unassigned"}
                  </p>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
