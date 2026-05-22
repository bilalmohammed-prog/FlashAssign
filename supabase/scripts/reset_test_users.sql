-- Replace emails below with the two test accounts you want to remove.
-- Run with a service role in SQL editor. This script deletes app data tied to those users
-- and removes empty organizations left behind.

begin;

create temp table target_users as
select id, email
from auth.users
where email in (
  'user1@example.com',
  'user2@example.com'
);

-- User-scoped data
delete from public.messages
where sender_id in (select id from target_users)
   or recipient_id in (select id from target_users);

delete from public.comments
where user_id in (select id from target_users);

delete from public.assignments
where user_id in (select id from target_users);

delete from public.project_members
where user_id in (select id from target_users);

delete from public.manager_employees
where employee_id in (select id from target_users)
   or manager_id in (select id from target_users);

delete from public.invites
where inviter_id in (select id from target_users)
   or invite_email in (select email from target_users);

delete from public.org_members
where user_id in (select id from target_users);

-- Remove organizations left without members
create temp table target_orgs as
select o.id
from public.organizations o
left join public.org_members om on om.organization_id = o.id
where om.id is null;

-- Org-scoped data cleanup (if orgs were removed)
delete from public.messages
where organization_id in (select id from target_orgs);

delete from public.comments
where organization_id in (select id from target_orgs);

delete from public.assignments
where organization_id in (select id from target_orgs);

delete from public.tasks
where organization_id in (select id from target_orgs);

delete from public.project_members
where organization_id in (select id from target_orgs);

delete from public.projects
where organization_id in (select id from target_orgs);

delete from public.invites
where organization_id in (select id from target_orgs);

delete from public.organizations
where id in (select id from target_orgs);

-- Profiles and auth users
delete from public.profiles
where id in (select id from target_users);

delete from auth.users
where id in (select id from target_users);

commit;
