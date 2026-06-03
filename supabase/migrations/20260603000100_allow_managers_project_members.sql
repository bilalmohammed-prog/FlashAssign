-- Align project and project membership mutations with project management permissions.
-- Managers can create/update/delete projects, so they can also add/remove project members.

begin;

drop policy if exists projects_insert_member on public.projects;
drop policy if exists projects_update_member on public.projects;
drop policy if exists projects_delete_member on public.projects;
drop policy if exists project_members_insert_owner_admin on public.project_members;
drop policy if exists project_members_update_owner_admin on public.project_members;
drop policy if exists project_members_delete_owner_admin on public.project_members;

create policy projects_insert_member
on public.projects
for insert
to authenticated
with check (
  public.is_org_member(organization_id)
  and public.org_role(organization_id) in ('owner', 'admin', 'manager')
);

create policy projects_update_member
on public.projects
for update
to authenticated
using (
  public.is_org_member(organization_id)
  and public.org_role(organization_id) in ('owner', 'admin', 'manager')
)
with check (
  public.is_org_member(organization_id)
  and public.org_role(organization_id) in ('owner', 'admin', 'manager')
);

create policy projects_delete_member
on public.projects
for delete
to authenticated
using (
  public.is_org_member(organization_id)
  and public.org_role(organization_id) in ('owner', 'admin', 'manager')
);

create policy project_members_insert_owner_admin
on public.project_members
for insert
to authenticated
with check (
  public.is_org_member(organization_id)
  and public.org_role(organization_id) in ('owner', 'admin', 'manager')
  and exists (
    select 1
    from public.projects p
    where p.id = project_members.project_id
      and p.organization_id = project_members.organization_id
      and p.deleted_at is null
  )
  and exists (
    select 1
    from public.org_members om
    where om.organization_id = project_members.organization_id
      and om.user_id = project_members.user_id
  )
);

create policy project_members_update_owner_admin
on public.project_members
for update
to authenticated
using (
  public.is_org_member(organization_id)
  and public.org_role(organization_id) in ('owner', 'admin', 'manager')
)
with check (
  public.is_org_member(organization_id)
  and public.org_role(organization_id) in ('owner', 'admin', 'manager')
  and exists (
    select 1
    from public.projects p
    where p.id = project_members.project_id
      and p.organization_id = project_members.organization_id
      and p.deleted_at is null
  )
  and exists (
    select 1
    from public.org_members om
    where om.organization_id = project_members.organization_id
      and om.user_id = project_members.user_id
  )
);

create policy project_members_delete_owner_admin
on public.project_members
for delete
to authenticated
using (
  public.is_org_member(organization_id)
  and public.org_role(organization_id) in ('owner', 'admin', 'manager')
);

commit;
