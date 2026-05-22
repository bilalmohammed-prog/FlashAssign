"use server";

import { requireOrgContext } from "@/actions/_helpers/requireOrgContext";

export type ProjectWithMeta = {
  id: string;
  name: string;
  status: "active" | "paused" | "archived";
  startDate: string | null;
  endDate: string | null;
  memberCount: number;
  completed: number;
  total: number;
};

type ListProjectsWithMetaParams = {
  organizationId?: string | null;
  pageSize?: number;
  pageOffset?: number;
};

type ProjectWithMetaRow = {
  id: string;
  name: string;
  status: "active" | "paused" | "archived" | null;
  start_date: string | null;
  end_date: string | null;
  member_count: number | null;
  completed: number | null;
  total: number | null;
};

export async function listProjectsWithMetaAction(
  params: ListProjectsWithMetaParams = {}
): Promise<ProjectWithMeta[]> {
  const ctx = await requireOrgContext({ organizationId: params.organizationId ?? undefined });
  const pageSize = params.pageSize ?? 12;
  const pageOffset = params.pageOffset ?? 0;

  const { data, error } = await ctx.supabase.rpc("list_projects_with_meta", {
    org_uuid: ctx.organizationId,
    page_size: pageSize,
    page_offset: pageOffset,
  });

  if (error) {
    throw new Error(error.message);
  }

  return (data as ProjectWithMetaRow[] | null ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    status: row.status ?? "active",
    startDate: row.start_date,
    endDate: row.end_date,
    memberCount: Number(row.member_count ?? 0),
    completed: Number(row.completed ?? 0),
    total: Number(row.total ?? 0),
  }));
}
