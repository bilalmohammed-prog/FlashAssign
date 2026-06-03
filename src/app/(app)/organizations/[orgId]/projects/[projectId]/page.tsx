import { notFound } from "next/navigation";
import { requireOrgContext } from "@/actions/_helpers/requireOrgContext";
import ProjectWorkspaceClient, {
  type ProjectWorkspaceInitialData,
} from "./ProjectWorkspaceClient";
import { getTasksByProject } from "@/services/task/task.service";
import type { Tables } from "@/lib/types/database";

type ProjectWorkspacePageProps = {
  params: Promise<{ orgId: string; projectId: string }>;
};

type ProjectRecord = Pick<Tables<"projects">, "id" | "name" | "organization_id">;

type ProjectMemberRow = {
  id: string;
  user_id: string;
  role: string | null;
  joined_at: string | null;
  left_at: string | null;
};

type AssignmentRow = {
  task_id: string;
  user_id: string;
  created_at: string | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
};

export default async function ProjectWorkspacePage({ params }: ProjectWorkspacePageProps) {
  const { orgId, projectId } = await params;

  console.time("[Page] project workspace total");
  console.time("[Fetch] project workspace requireOrgContext");
  const tenant = await requireOrgContext({ organizationId: orgId });
  
  console.timeEnd("[Fetch] project workspace requireOrgContext");

  console.time("[DB] project workspace base queries");
  const projectPromise = tenant.supabase
    .from("projects")
    .select("id,name,organization_id")
    .eq("id", projectId)
    .eq("organization_id", tenant.organizationId)
    .is("deleted_at", null)
    .maybeSingle<ProjectRecord>();

  const tasksPromise = getTasksByProject(tenant.supabase, {
    organizationId: tenant.organizationId,
    projectId,
  });

  const membersPromise = tenant.supabase
    .from("project_members")
    .select("id,user_id,role,joined_at,left_at")
    .eq("organization_id", tenant.organizationId)
    .eq("project_id", projectId)
    .is("left_at", null)
    .order("joined_at", { ascending: true });

  const [projectResult, tasksResult, membersResult] = await Promise.all([
    projectPromise,
    tasksPromise,
    membersPromise,
  ]);
  console.timeEnd("[DB] project workspace base queries");

  if (projectResult.error) {
    throw new Error(projectResult.error.message);
  }
  if (membersResult.error) {
    throw new Error(membersResult.error.message);
  }

  const project = projectResult.data;
  if (!project) {
    notFound();
  }

  const tasks = tasksResult ?? [];
  const projectMemberRows = (membersResult.data ?? []) as ProjectMemberRow[];
  const taskIds = tasks.map((task) => task.id);

  // POTENTIAL WATERFALL
  // Assignment hydration depends on the initial task list, but still stays on the server path.
  console.time("[DB] project workspace assignee assignments");
  const assignmentsResult =
    taskIds.length > 0
      ? await tenant.supabase
          .from("assignments")
          .select("task_id,user_id,created_at")
          .eq("organization_id", tenant.organizationId)
          .in("task_id", taskIds)
          .order("created_at", { ascending: false })
      : { data: [], error: null };
  console.timeEnd("[DB] project workspace assignee assignments");

  if (assignmentsResult.error) {
    throw new Error(assignmentsResult.error.message);
  }

  const assignmentRows = (assignmentsResult.data ?? []) as AssignmentRow[];
  const taskAssigneeById = new Map<string, string>();
  const profileIds = new Set<string>();

  for (const row of assignmentRows) {
    if (!taskAssigneeById.has(row.task_id)) {
      taskAssigneeById.set(row.task_id, row.user_id);
      profileIds.add(row.user_id);
    }
  }

  for (const row of projectMemberRows) {
    profileIds.add(row.user_id);
  }

  console.time("[DB] project workspace profiles");
  const profilesResult =
    profileIds.size > 0
      ? await tenant.supabase
          .from("profiles")
          .select("id,full_name")
          .in("id", Array.from(profileIds))
      : { data: [], error: null };
  console.timeEnd("[DB] project workspace profiles");

  if (profilesResult.error) {
    throw new Error(profilesResult.error.message);
  }

  const profiles = (profilesResult.data ?? []) as ProfileRow[];
  const profileNameById = new Map<string, string | null>();
  for (const profile of profiles) {
    profileNameById.set(profile.id, profile.full_name);
  }

  console.time("[Compute] project workspace hydrate");
  const projectMembers = projectMemberRows.map((member) => ({
    user_id: member.user_id,
    name: profileNameById.get(member.user_id) ?? "",
  }));

  const initialTasks = tasks.map((task) => {
    const assigneeId = taskAssigneeById.get(task.id) ?? null;
    return {
      ...task,
      assignee_id: assigneeId,
      assignee_name: assigneeId ? profileNameById.get(assigneeId) ?? null : null,
    };
  });

  console.timeEnd("[Compute] project workspace hydrate");
  console.timeEnd("[Page] project workspace total");

  const initialData: ProjectWorkspaceInitialData = {
    orgId: tenant.organizationId,
    projectId: project.id,
    projectName: project.name,
    role: tenant.role,
    userId: tenant.userId,
    projectMembers,
    tasks: initialTasks,
  };

  return <ProjectWorkspaceClient initialData={initialData} />;
}
