create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, anon;

create table public.users (
 id uuid primary key references auth.users(id) on delete cascade,
 role text not null check (role in ('volunteer','organization')),
 created_at timestamptz not null default now()
);
create table public.profiles (
 user_id uuid primary key references public.users(id) on delete cascade,
 display_name text not null check (length(trim(display_name)) between 2 and 80),
 bio text not null default '' check (length(bio)<=1000), city text not null default 'Williamsburg',
 avatar_path text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.groups (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null unique references public.users(id),
 name text not null check (length(trim(name)) between 2 and 120), slug text not null unique,
 description text not null check (length(description) between 10 and 2000), city text not null,
 website_url text check (website_url is null or website_url ~ '^https?://'),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.event_series (
 id uuid primary key default gen_random_uuid(), group_id uuid not null references public.groups(id),
 frequency text not null default 'weekly' check (frequency='weekly'), interval_weeks smallint not null check (interval_weeks in (1,2)),
 occurrence_count smallint not null check (occurrence_count between 2 and 12), timezone text not null,
 first_local_start timestamp not null, duration_minutes integer not null check (duration_minutes between 15 and 720),
 created_at timestamptz not null default now(), unique(id,group_id)
);
create table public.events (
 id uuid primary key default gen_random_uuid(), group_id uuid not null references public.groups(id),
 series_id uuid, occurrence_index smallint,
 title text not null check (length(trim(title)) between 3 and 150), description text not null check (length(description) between 10 and 4000),
 venue text not null, address text not null, city text not null,
 starts_at timestamptz not null, ends_at timestamptz not null, timezone text not null default 'America/New_York',
 resources_to_bring text[] not null default '{}', status text not null default 'published' check (status in ('published','cancelled')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check (ends_at>starts_at), check ((series_id is null)=(occurrence_index is null)),
 unique(series_id,occurrence_index), foreign key(series_id,group_id) references public.event_series(id,group_id)
);
create table public.event_tasks (
 id uuid primary key default gen_random_uuid(), event_id uuid not null references public.events(id),
 name text not null check (length(trim(name)) between 2 and 100), description text not null default '',
 capacity integer not null check (capacity between 1 and 500),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(id,event_id), unique(event_id,name)
);
create table public.signups (
 id uuid primary key default gen_random_uuid(), event_id uuid not null references public.events(id),
 task_id uuid not null, volunteer_id uuid not null references public.users(id),
 status text not null default 'active' check (status in ('active','withdrawn')),
 verified_minutes integer check (verified_minutes between 0 and 720), verified_by uuid references public.users(id), verified_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(event_id,volunteer_id), foreign key(task_id,event_id) references public.event_tasks(id,event_id),
 check ((verified_minutes is null and verified_by is null and verified_at is null) or (verified_minutes is not null and verified_by is not null and verified_at is not null))
);
create table public.event_comments (
 id uuid primary key default gen_random_uuid(), event_id uuid not null references public.events(id), author_id uuid not null references public.users(id),
 body text not null check (length(trim(body)) between 1 and 2000), hidden_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index events_upcoming on public.events(status,starts_at,id);
create index events_group on public.events(group_id,starts_at);
create index events_city on public.events(lower(city));
create index signups_task on public.signups(task_id,status);
create index signups_volunteer on public.signups(volunteer_id);
create index comments_event on public.event_comments(event_id,created_at,id);

create function private.owns_group(g uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.groups where id=g and owner_id=auth.uid());
$$;
create function private.owns_event(e uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.events where id=e and private.owns_group(group_id));
$$;
create function private.can_read_thread(e uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.owns_event(e) or exists(select 1 from public.signups where event_id=e and volunteer_id=auth.uid() and status='active');
$$;

alter table public.users enable row level security;
alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.event_series enable row level security;
alter table public.events enable row level security;
alter table public.event_tasks enable row level security;
alter table public.signups enable row level security;
alter table public.event_comments enable row level security;
revoke all on public.users,public.profiles,public.groups,public.event_series,public.events,public.event_tasks,public.signups,public.event_comments from anon,authenticated;
grant select on public.users,public.profiles,public.signups,public.event_comments,public.event_series to authenticated;
grant select on public.events,public.event_tasks to anon,authenticated;
grant select(id,name,slug,description,city,website_url,created_at,updated_at) on public.groups to anon,authenticated;
create policy own_user on public.users for select to authenticated using(id=auth.uid());
create policy own_profile on public.profiles for select to authenticated using(user_id=auth.uid());
create policy public_groups on public.groups for select using(true);
create policy own_series on public.event_series for select to authenticated using(private.owns_group(group_id));
create policy public_events on public.events for select using(true);
create policy public_tasks on public.event_tasks for select using(true);
create policy scoped_signups on public.signups for select to authenticated using(volunteer_id=auth.uid() or private.owns_event(event_id));
create policy scoped_comments on public.event_comments for select to authenticated using(private.can_read_thread(event_id));

-- Role is initialized once; later edits to auth metadata cannot grant organization ownership.
create function private.on_auth_user() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.users(id,role) values(new.id,case when new.raw_user_meta_data->>'role'='organization' then 'organization' else 'volunteer' end);
 insert into public.profiles(user_id,display_name) values(new.id,left(coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'),''),'Community member'),80));
 return new;
end $$;
create trigger auth_user_created after insert on auth.users for each row execute function private.on_auth_user();

-- One deliberately narrow public read contract. No emails, owner IDs (except one's own), or unrelated attendees.
create function public.app_snapshot() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
 'profile',(select jsonb_build_object('id',u.id,'role',u.role,'display_name',p.display_name,'bio',p.bio,'city',p.city,'avatar_path',p.avatar_path) from public.users u join public.profiles p on p.user_id=u.id where u.id=auth.uid()),
 'groups',coalesce((select jsonb_agg((to_jsonb(g)-'owner_id') || case when g.owner_id=auth.uid() then jsonb_build_object('owner_id',g.owner_id) else '{}'::jsonb end) from public.groups g),'[]'::jsonb),
 'events',coalesce((select jsonb_agg(to_jsonb(e) order by e.starts_at,e.id) from public.events e),'[]'::jsonb),
 'tasks',coalesce((select jsonb_agg(to_jsonb(t)||jsonb_build_object('reserved',(select count(*) from public.signups s where s.task_id=t.id and s.status='active'))) from public.event_tasks t),'[]'::jsonb),
 'signups',coalesce((select jsonb_agg(to_jsonb(s)||jsonb_build_object('display_name',p.display_name)) from public.signups s join public.profiles p on p.user_id=s.volunteer_id where s.volunteer_id=auth.uid() or private.owns_event(s.event_id)),'[]'::jsonb),
 'comments',coalesce((select jsonb_agg((to_jsonb(c)-'body')||jsonb_build_object('body',case when c.hidden_at is null then c.body else '' end,'display_name',p.display_name) order by c.created_at,c.id) from public.event_comments c join public.profiles p on p.user_id=c.author_id where private.can_read_thread(c.event_id)),'[]'::jsonb)
 );
$$;

-- All writes go through this authorized transactional boundary; direct client table writes are revoked.
create function public.app_command(kind text, payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare
 actor uuid := auth.uid(); actor_role text; gid uuid; eid uuid; sid uuid; tid uuid;
 ev public.events; task public.event_tasks; signup public.signups; comment public.event_comments;
 row_data jsonb; item jsonb; idx int; amount int; total int; step int; duration int;
 local_start timestamp; start_instant timestamptz; zone text; series uuid; first_id uuid;
begin
 if actor is null then raise exception 'Sign in to continue.' using errcode='28000'; end if;
 select role into actor_role from public.users where id=actor;
 if actor_role is null then raise exception 'Account profile is missing.'; end if;

 if kind='profile' then
  update public.profiles set display_name=trim(payload->>'display_name'),bio=coalesce(payload->>'bio',''),city=trim(payload->>'city'),updated_at=now() where user_id=actor;
 elsif kind='avatar' then
  if payload->>'path' not like actor::text||'/%' then raise exception 'Invalid avatar path.'; end if;
  if not exists(select 1 from storage.objects where bucket_id='avatars' and name=payload->>'path' and owner_id=actor::text) then raise exception 'Upload the image first.'; end if;
  update public.profiles set avatar_path=payload->>'path',updated_at=now() where user_id=actor;
 elsif kind='group' then
  if actor_role<>'organization' then raise exception 'Organization account required.' using errcode='42501'; end if;
  select id into gid from public.groups where owner_id=actor;
  if gid is null then
   gid:=gen_random_uuid();
   insert into public.groups(id,owner_id,name,slug,description,city,website_url) values(gid,actor,trim(payload->>'name'),trim(both '-' from regexp_replace(lower(payload->>'name'),'[^a-z0-9]+','-','g'))||'-'||left(gid::text,8),payload->>'description',payload->>'city',nullif(payload->>'website_url',''));
  else
   update public.groups set name=trim(payload->>'name'),description=payload->>'description',city=payload->>'city',website_url=nullif(payload->>'website_url',''),updated_at=now() where id=gid;
  end if;
  return jsonb_build_object('id',gid);
 elsif kind='create_event' then
  select id into gid from public.groups where owner_id=actor;
  if actor_role<>'organization' or gid is null then raise exception 'Create your organization group first.' using errcode='42501'; end if;
  total:=case when (payload->>'interval')::int=0 then 1 else (payload->>'count')::int end;
  step:=(payload->>'interval')::int; duration:=(payload->>'duration')::int;
  if step is null or step not between 0 and 2 or total is null or total not between 1 and 12 or (step>0 and total<2) or duration is null or duration not between 15 and 720 then raise exception 'Invalid recurrence or duration.'; end if;
  if jsonb_typeof(payload->'tasks') is distinct from 'array' or jsonb_array_length(payload->'tasks') not between 1 and 12 then raise exception 'Add 1–12 tasks.'; end if;
  zone:=payload->>'timezone'; local_start:=(payload->>'localStart')::timestamp;
  if zone is null or not exists(select 1 from pg_timezone_names where name=zone) then raise exception 'Invalid time zone.'; end if;
  if step>0 then
   insert into public.event_series(group_id,interval_weeks,occurrence_count,timezone,first_local_start,duration_minutes) values(gid,step,total,zone,local_start,duration) returning id into series;
  end if;
  for idx in 0..total-1 loop
   start_instant:=(local_start + make_interval(weeks=>idx*step)) at time zone zone;
   if start_instant<=now() or start_instant is null then raise exception 'Choose a future start time.'; end if;
   if start_instant at time zone zone <> local_start + make_interval(weeks=>idx*step)
    or exists(select 1 from (values(interval '30 minutes'),(interval '1 hour'),(interval '2 hours'),(interval '-30 minutes'),(interval '-1 hour'),(interval '-2 hours')) offsets(delta) where (start_instant+delta) at time zone zone = start_instant at time zone zone)
    then raise exception 'Choose a time outside a daylight saving transition.'; end if;
   insert into public.events(group_id,series_id,occurrence_index,title,description,venue,address,city,starts_at,ends_at,timezone,resources_to_bring)
   values(gid,series,case when series is null then null else idx end,trim(payload->>'title'),payload->>'description',payload->>'venue',payload->>'address',payload->>'city',start_instant,start_instant+make_interval(mins=>duration),zone,array(select trim(value) from jsonb_array_elements_text(coalesce(payload->'resources_to_bring','[]')))) returning id into eid;
   first_id:=coalesce(first_id,eid);
   for item in select value from jsonb_array_elements(payload->'tasks') loop
    insert into public.event_tasks(event_id,name,description,capacity) values(eid,trim(item->>'name'),coalesce(item->>'description',''),(item->>'capacity')::int);
   end loop;
  end loop;
  return jsonb_build_object('id',first_id);
 elsif kind in ('join','withdraw','update_event','cancel','verify','comment','hide_comment') then
  if kind='verify' then
   select event_id into eid from public.signups where id=(payload->>'signup_id')::uuid;
  elsif kind='hide_comment' then
   select * into comment from public.event_comments where id=(payload->>'comment_id')::uuid;
   eid:=comment.event_id;
  else eid:=(payload->>'event_id')::uuid; end if;
  -- Event-first locking serializes capacity, cancellation, schedule edits, and reservations.
  select * into ev from public.events where id=eid for update;
  if not found then raise exception 'Event not found.'; end if;
  if kind in ('update_event','cancel','verify') and not private.owns_event(eid) then raise exception 'You do not manage this event.' using errcode='42501'; end if;
  if kind in ('join','withdraw') then
   if actor_role<>'volunteer' then raise exception 'Volunteer account required.' using errcode='42501'; end if;
   if ev.status<>'published' or ev.starts_at<=now() then raise exception 'Reservations are closed.'; end if;
   select * into signup from public.signups where event_id=eid and volunteer_id=actor for update;
   if kind='withdraw' then
    update public.signups set status='withdrawn',updated_at=now() where id=signup.id;
   else
    tid:=(payload->>'task_id')::uuid;
    if signup.status='active' then
     if signup.task_id=tid then return jsonb_build_object('id',signup.id); end if;
     raise exception 'Withdraw your current reservation before changing tasks.';
    end if;
    select * into task from public.event_tasks where id=tid and event_id=eid for update;
    if not found then raise exception 'Task not found for this event.'; end if;
    if (select count(*) from public.signups where task_id=tid and status='active')>=task.capacity then raise exception 'This task is full.'; end if;
    insert into public.signups(event_id,task_id,volunteer_id) values(eid,tid,actor)
    on conflict(event_id,volunteer_id) do update set task_id=excluded.task_id,status='active',updated_at=now() returning id into sid;
    return jsonb_build_object('id',sid);
   end if;
  elsif kind='update_event' then
   if ev.starts_at<=now() or ev.status<>'published' then raise exception 'Only future published events can be edited.'; end if;
   start_instant:=(payload->>'starts_at')::timestamptz; duration:=(payload->>'duration')::int;
   if start_instant is null or start_instant<=now() or duration is null or duration not between 15 and 720 then raise exception 'Choose a future start and valid duration.'; end if;
   update public.events set title=trim(payload->>'title'),description=payload->>'description',venue=payload->>'venue',address=payload->>'address',city=payload->>'city',starts_at=start_instant,ends_at=start_instant+make_interval(mins=>duration),resources_to_bring=array(select value from jsonb_array_elements_text(payload->'resources_to_bring')),updated_at=now() where id=eid;
   for item in select value from jsonb_array_elements(payload->'tasks') loop
    select * into task from public.event_tasks where id=(item->>'id')::uuid and event_id=eid for update;
    if not found then raise exception 'Task not found.'; end if;
    amount:=(item->>'capacity')::int;
    if amount<(select count(*) from public.signups where task_id=task.id and status='active') then raise exception 'Capacity cannot fall below active reservations.'; end if;
    update public.event_tasks set capacity=amount,updated_at=now() where id=task.id;
   end loop;
  elsif kind='cancel' then
   if ev.ends_at<=now() then raise exception 'Completed events cannot be cancelled.'; end if;
   update public.events set status='cancelled',updated_at=now() where id=eid;
  elsif kind='verify' then
   amount:=(payload->>'minutes')::int;
   if ev.status<>'published' or ev.ends_at>now() then raise exception 'Verify attendance after a noncancelled event ends.'; end if;
   if amount is null or amount<0 or amount>extract(epoch from(ev.ends_at-ev.starts_at))/60 then raise exception 'Minutes must be within the event duration.'; end if;
   update public.signups set verified_minutes=amount,verified_by=actor,verified_at=now(),updated_at=now() where id=(payload->>'signup_id')::uuid and status='active';
   if not found then raise exception 'Active signup not found.'; end if;
  elsif kind='comment' then
   if not private.can_read_thread(eid) then raise exception 'Reserve a task to join this conversation.' using errcode='42501'; end if;
   if ev.status<>'published' or now()>ev.ends_at+interval '24 hours' then raise exception 'This conversation is read-only.'; end if;
   insert into public.event_comments(event_id,author_id,body) values(eid,actor,trim(payload->>'body'));
  elsif kind='hide_comment' then
   if not private.can_read_thread(eid) or (comment.author_id<>actor and not private.owns_event(eid)) then raise exception 'You cannot hide this message.' using errcode='42501'; end if;
   update public.event_comments set hidden_at=now(),body='Message removed.',updated_at=now() where id=comment.id;
  end if;
 else raise exception 'Unknown operation.'; end if;
 return jsonb_build_object('id',coalesce(eid,actor));
end $$;

revoke all on function public.app_snapshot() from public;
grant execute on function public.app_snapshot() to anon,authenticated;
revoke all on function public.app_command(text,jsonb) from public;
grant execute on function public.app_command(text,jsonb) to authenticated;
revoke all on all functions in schema private from public;
grant execute on function private.owns_group(uuid),private.owns_event(uuid),private.can_read_thread(uuid) to anon,authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('avatars','avatars',false,2097152,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
create policy own_avatar_insert on storage.objects for insert to authenticated with check(bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text);
create policy own_avatar_read on storage.objects for select to authenticated using(bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text);
create policy own_avatar_delete on storage.objects for delete to authenticated using(bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text);
-- Supabase projects provide this publication; the local SQL test harness creates a substitute.
alter publication supabase_realtime add table public.event_comments;
