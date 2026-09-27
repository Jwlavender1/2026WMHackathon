-- Retain only an identity fingerprint/cutoff to reject sessions created before deletion.
-- A later, fresh Auth0 login can start a new Turnout account, never restore the old one.
create table private.deleted_accounts (
 subject_hash text primary key,
 deleted_at timestamptz not null
);
revoke all on private.deleted_accounts from public,commonly_runtime;

create function public.app_resolve_user(subject text, display_name text, session_created_at bigint)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid; cutoff timestamptz;
begin
 if subject is null or length(subject) not between 3 and 255 then raise exception 'Invalid identity.'; end if;
 -- Resolve and all subsequent work share the server request's transaction. Deletion
 -- cannot race a snapshot or mutation into recreating the same account.
 perform pg_advisory_xact_lock(hashtextextended(subject,0));
 select deleted_at into cutoff from private.deleted_accounts
  where subject_hash=encode(sha256(convert_to(subject,'UTF8')),'hex');
 if cutoff is not null and (session_created_at is null or to_timestamp(session_created_at)<=cutoff) then
  return null;
 end if;
 insert into public.users(auth0_sub) values(subject) on conflict(auth0_sub) do nothing;
 select id into actor from public.users where auth0_sub=subject;
 insert into public.profiles(user_id,display_name)
  values(actor,left(case when length(trim(display_name))>=2 then trim(display_name) else 'Community member' end,80))
  on conflict(user_id) do nothing;
 return actor;
end $$;
revoke all on function public.app_resolve_user(text,text,bigint) from public;
grant execute on function public.app_resolve_user(text,text,bigint) to commonly_runtime;

-- Older app instances may still call the two-argument function during rollout.
-- They can resolve existing identities, but cannot recreate a deleted account.
create or replace function public.app_resolve_user(subject text, display_name text)
returns uuid language sql security definer set search_path='' as $$
 select public.app_resolve_user(subject,display_name,null::bigint);
$$;

-- Archived groups remain as attribution for historical events, without an owner account.
alter table public.groups alter column owner_id drop not null;
alter table public.groups add column archived_at timestamptz;
alter table public.groups add constraint groups_archive_owner_check
 check ((archived_at is null)=(owner_id is not null));
grant select(archived_at) on public.groups to commonly_runtime;

-- An organizer's deletion removes its identity, not the hours it already verified.
alter table public.signups drop constraint signups_check;
alter table public.signups add constraint signups_verification_check check (
 (verified_minutes is null and verified_by is null and verified_at is null)
 or (verified_minutes is not null and verified_at is not null)
);

create function public.app_delete_account(confirmation text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.actor_id(); subject text; actor_role text;
begin
 if actor is null then raise exception 'Sign in to continue.' using errcode='28000'; end if;
 if confirmation is distinct from 'DELETE' then raise exception 'Type DELETE to confirm.'; end if;
 select auth0_sub into subject from public.users where id=actor;
 if not found then raise exception 'Account profile is missing.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(subject,0));
 select role into actor_role from public.users where id=actor for update;
 if actor_role is null then raise exception 'Complete your profile first.'; end if;
 -- Use the same event-first locks as reservations and attendance verification.
 perform 1 from public.events e where e.group_id in(
  select id from public.groups where owner_id=actor
 ) or exists(
  select 1 from public.signups s where s.event_id=e.id and (s.volunteer_id=actor or s.verified_by=actor)
 ) order by e.id for update;
 insert into private.deleted_accounts(subject_hash,deleted_at)
  values(encode(sha256(convert_to(subject,'UTF8')),'hex'),clock_timestamp())
  on conflict(subject_hash) do update set deleted_at=excluded.deleted_at;
 if actor_role='organization' then
  update public.events set status='cancelled',updated_at=clock_timestamp()
   where group_id in(select id from public.groups where owner_id=actor)
   and status='published' and ends_at>clock_timestamp();
  update public.groups set owner_id=null,archived_at=clock_timestamp(),updated_at=clock_timestamp(),
   description='This organization is no longer active on Turnout.',city='',location=null,
   website_url=null,public_contact_email=null,causes='{}'
   where owner_id=actor;
 end if;
 update public.signups set verified_by=null,updated_at=clock_timestamp() where verified_by=actor;
 delete from public.event_comments where author_id=actor;
 delete from public.signups where volunteer_id=actor;
 -- Profiles and uploaded avatars cascade from users.
 delete from public.users where id=actor;
 return jsonb_build_object('id',actor);
end $$;
revoke all on function public.app_delete_account(text) from public;
grant execute on function public.app_delete_account(text) to commonly_runtime;
