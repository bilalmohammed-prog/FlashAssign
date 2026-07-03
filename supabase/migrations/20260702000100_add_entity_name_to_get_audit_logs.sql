-- Extend audit log fetching to resolve a display name for member targets.

begin;

create or replace function public.get_audit_logs(
  p_organization_id uuid,
  p_project_id uuid default null,
  p_search text default null,
  p_action text default null,
  p_entity_type text default null,
  p_sort_by text default 'created_at',
  p_sort_dir text default 'desc',
  p_cursor text default null,
  p_limit integer default 25
)
returns table (
  id uuid,
  organization_id uuid,
  project_id uuid,
  actor_id uuid,
  actor_name text,
  action text,
  entity_type text,
  entity_id uuid,
  entity_name text,
  changes jsonb,
  created_at timestamptz,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  sort_column text;
  sort_direction text;
begin
  sort_column := case p_sort_by
    when 'action' then 'action'
    when 'entity_type' then 'entity_type'
    else 'created_at'
  end;

  sort_direction := case lower(coalesce(p_sort_dir, 'desc'))
    when 'asc' then 'asc'
    else 'desc'
  end;

  return query
  with base as (
    select
      a.id,
      a.organization_id,
      a.project_id,
      a.actor_id,
      coalesce(actor.full_name, actor.username, 'Unknown user') as actor_name,
      a.action,
      a.entity_type,
      a.entity_id,
      case
        when a.entity_type = 'member' then
          coalesce(target_profile.full_name, target_profile.username, 'Unknown member')
        else null
      end as entity_name,
      coalesce(a.changes, '[]'::jsonb) as changes,
      a.created_at
    from public.audit_logs a
    left join public.profiles actor
      on actor.id = a.actor_id
    left join public.org_members target_member
      on a.entity_type = 'member'
     and target_member.id = a.entity_id
    left join public.profiles target_profile
      on target_profile.id = target_member.user_id
    where a.organization_id = p_organization_id
      and (p_project_id is null or a.project_id = p_project_id)
      and (p_action is null or a.action = p_action)
      and (p_entity_type is null or a.entity_type = p_entity_type)
      and (
        p_search is null
        or actor.full_name ilike '%' || p_search || '%'
        or actor.username ilike '%' || p_search || '%'
        or coalesce(target_profile.full_name, target_profile.username, '') ilike '%' || p_search || '%'
        or a.action ilike '%' || p_search || '%'
        or a.entity_type ilike '%' || p_search || '%'
        or a.entity_id::text ilike '%' || p_search || '%'
      )
  ),
  ranked as (
    select
      base.*,
      count(*) over() as total_count
    from base
    where (
      p_cursor is null
      or case
        when sort_column = 'created_at' and sort_direction = 'desc' then base.created_at < p_cursor::timestamptz
        when sort_column = 'created_at' and sort_direction = 'asc' then base.created_at > p_cursor::timestamptz
        else true
      end
    )
  )
  select
    ranked.id,
    ranked.organization_id,
    ranked.project_id,
    ranked.actor_id,
    ranked.actor_name,
    ranked.action,
    ranked.entity_type,
    ranked.entity_id,
    ranked.entity_name,
    ranked.changes,
    ranked.created_at,
    ranked.total_count
  from ranked
  order by
    case when sort_column = 'action' and sort_direction = 'asc' then ranked.action end asc,
    case when sort_column = 'action' and sort_direction = 'desc' then ranked.action end desc,
    case when sort_column = 'entity_type' and sort_direction = 'asc' then ranked.entity_type end asc,
    case when sort_column = 'entity_type' and sort_direction = 'desc' then ranked.entity_type end desc,
    case when sort_column = 'created_at' and sort_direction = 'asc' then ranked.created_at end asc,
    case when sort_column = 'created_at' and sort_direction = 'desc' then ranked.created_at end desc,
    ranked.created_at desc,
    ranked.id desc
  limit coalesce(p_limit, 25);
end;
$$;

grant execute on function public.get_audit_logs(uuid, uuid, text, text, text, text, text, text, integer) to authenticated;

commit;