-- Harden comments RLS for org-scoped access.

begin;

alter table public.comments enable row level security;

drop policy if exists comments_select_org_member on public.comments;
drop policy if exists comments_insert_org_member_as_author on public.comments;
drop policy if exists comments_update_author_or_manager on public.comments;
drop policy if exists comments_delete_author_or_manager on public.comments;

create policy comments_select_org_member
on public.comments
for select
to authenticated
using (
  deleted_at is null
  and exists (
    select 1
    from public.org_members om
    where om.organization_id = comments.organization_id
      and om.user_id = auth.uid()
  )
);

create policy comments_insert_org_member_as_author
on public.comments
for insert
to authenticated
with check (
  deleted_at is null
  and user_id = auth.uid()
  and exists (
    select 1
    from public.org_members om
    where om.organization_id = comments.organization_id
      and om.user_id = auth.uid()
  )
);

create policy comments_update_author_or_manager
on public.comments
for update
to authenticated
using (
  deleted_at is null
  and exists (
    select 1
    from public.org_members om
    where om.organization_id = comments.organization_id
      and om.user_id = auth.uid()
  )
  and (
    user_id = auth.uid()
    or public.org_role(comments.organization_id) in ('owner', 'admin', 'manager')
  )
)
with check (
  deleted_at is null
  and exists (
    select 1
    from public.org_members om
    where om.organization_id = comments.organization_id
      and om.user_id = auth.uid()
  )
  and (
    user_id = auth.uid()
    or public.org_role(comments.organization_id) in ('owner', 'admin', 'manager')
  )
);

create policy comments_delete_author_or_manager
on public.comments
for delete
to authenticated
using (
  deleted_at is null
  and exists (
    select 1
    from public.org_members om
    where om.organization_id = comments.organization_id
      and om.user_id = auth.uid()
  )
  and (
    user_id = auth.uid()
    or public.org_role(comments.organization_id) in ('owner', 'admin', 'manager')
  )
);

commit;
