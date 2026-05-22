import ProjectsClientPage from "./ProjectsClientPage";
import { listProjectsWithMetaAction } from "@/actions/project/listWithMeta";

type ProjectsPageProps = {
  params: { orgId: string };
};

export default async function ProjectsPage({ params }: ProjectsPageProps) {
  const initialProjects = await listProjectsWithMetaAction({
    organizationId: params.orgId,
    pageSize: 12,
    pageOffset: 0,
  });

  return <ProjectsClientPage orgId={params.orgId} initialProjects={initialProjects} />;
}
