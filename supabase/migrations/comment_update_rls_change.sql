begin;

drop policy if exists comments_update_author_or_manager on public.comments;

create policy comments_update_author_or_manager
on public.comments
for update
to authenticated
using (
  deleted_at is null
  and exists (
    select 1 from public.org_members om
    where om.organization_id = comments.organization_id
      and om.user_id = auth.uid()
  )
  and (
    user_id = auth.uid()
    or public.org_role(comments.organization_id) in ('owner', 'admin', 'manager')
  )
)
with check (
  exists (
    select 1 from public.org_members om
    where om.organization_id = comments.organization_id
      and om.user_id = auth.uid()
  )
  and (
    user_id = auth.uid()
    or public.org_role(comments.organization_id) in ('owner', 'admin', 'manager')
  )
);

commit;