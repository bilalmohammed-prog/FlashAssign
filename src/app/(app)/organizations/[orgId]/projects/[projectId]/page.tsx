import { notFound } from "next/navigation";
import { requireOrgContext } from "@/actions/_helpers/requireOrgContext";
import ProjectWorkspaceClient, {
  type ProjectWorkspaceInitialData,
} from "./ProjectWorkspaceClient";
import type { Tables } from "@/lib/types/database";

type ProjectWorkspacePageProps = {
  params: Promise<{ orgId: string; projectId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>; 
};

type ProjectRecord = Pick<Tables<"projects">, "id" | "name" | "organization_id">;

type ProjectMemberRow = {
  id: string;
  user_id: string;
  role: string | null;
  joined_at: string | null;
  left_at: string | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
};

export default async function ProjectWorkspacePage({ params, searchParams }: ProjectWorkspacePageProps) {
  const { orgId, projectId } = await params;
  const { assignee, status } = await searchParams;

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
// 1. Array check to handle Next.js query parameter arrays safely
const statusString = Array.isArray(status) ? status[0] : status;

// 2. Validate against your strict database enum options
const validStatuses = ["todo", "in_progress", "blocked", "done"] as const;
const statusFilterValue = validStatuses.includes(statusString as typeof validStatuses[number])
  ? (statusString as typeof validStatuses[number])
  : undefined;

// 3. Pass it to your promise call
const tasksPromise = tenant.supabase.rpc("list_project_tasks_with_meta", {
  org_uuid: tenant.organizationId,
  project_uuid: projectId,
  sort_by: "title",
  sort_order: "asc",
  page_size: 10,
  assignee_filter: typeof assignee === "string" && assignee !== "all" ? assignee : undefined,
  status_filter: statusFilterValue, // Perfectly typed now
});
  // Fetch tasks and metadata directly through the new RPC


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
  if (tasksResult.error) {
    throw new Error(tasksResult.error.message);
  }
  if (membersResult.error) {
    throw new Error(membersResult.error.message);
  }

  const project = projectResult.data;
  if (!project) {
    notFound();
  }

  const tasks = tasksResult.data ?? [];
  const projectMemberRows = (membersResult.data ?? []) as ProjectMemberRow[];
  const profileIds = new Set<string>();

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
  console.timeEnd("[Compute] project workspace hydrate");
  console.timeEnd("[Page] project workspace total");

  const initialData: ProjectWorkspaceInitialData = {
    orgId: tenant.organizationId,
    projectId: project.id,
    projectName: project.name,
    role: tenant.role,
    userId: tenant.userId,
    projectMembers,
    tasks,
    initialStatusFilter: statusFilterValue,
  };

  return <ProjectWorkspaceClient initialData={initialData} />;
}
