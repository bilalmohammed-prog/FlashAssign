begin;

create or replace function public.list_projects_with_meta(
  org_uuid uuid,
  page_size integer,
  page_offset integer
)
returns table (
  id uuid,
  name text,
  status text,
  start_date date,
  end_date date,
  member_count bigint,
  completed bigint,
  total bigint
)
language sql
stable
set search_path = public
as $$
  select
    p.id,
    p.name,
    p.status::text,
    p.start_date,
    p.end_date,
    coalesce(pm.member_count, 0) as member_count,
    coalesce(t.completed, 0) as completed,
    coalesce(t.total, 0) as total
  from public.projects p
  left join (
    select
      pm.project_id,
      count(*) as member_count
    from public.project_members pm
    where pm.organization_id = org_uuid
      and pm.left_at is null
    group by pm.project_id
  ) pm on pm.project_id = p.id
  left join (
    select
      t.project_id,
      count(*) as total,
      count(*) filter (where t.status = 'done') as completed
    from public.tasks t
    where t.organization_id = org_uuid
      and t.deleted_at is null
    group by t.project_id
  ) t on t.project_id = p.id
  where p.organization_id = org_uuid
    and p.deleted_at is null
  order by p.created_at desc
  limit page_size
  offset page_offset;
$$;

revoke all on function public.list_projects_with_meta(uuid, integer, integer) from public;
grant execute on function public.list_projects_with_meta(uuid, integer, integer) to authenticated;

commit;
