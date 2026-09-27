-- Community needs map: aggregate-only reads for signed-in users.
-- Volunteer interests are private per profile; this function only releases category totals,
-- and suppresses small counts (1-2) so a total cannot single out a neighbor.
create function private.suppress_small(n bigint) returns integer language sql immutable set search_path='' as $$
 select case when n between 1 and 2 then null else n::integer end;
$$;
revoke all on function private.suppress_small(bigint) from public;

create function public.app_community_needs(window_days integer default 30) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=private.actor_id(); result jsonb;
begin
 if actor is null or not exists(select 1 from public.users where id=actor and role is not null) then
  raise exception 'Sign in and complete your profile first.' using errcode='28000';
 end if;
 if window_days is null or window_days not between 1 and 90 then
  raise exception 'Choose a window between 1 and 90 days.';
 end if;
 with upcoming as (
  select e.id,e.title,e.group_id,e.categories,e.starts_at,e.city,e.venue,e.address,e.location
  from public.events e join public.groups g on g.id=e.group_id
  where e.status='published' and g.archived_at is null
   and e.starts_at>clock_timestamp() and e.starts_at<=clock_timestamp()+make_interval(days=>window_days)
 ), reserved as (
  select task_id,count(*) n from public.signups where status='active' group by task_id
 ), spots as (
  select t.event_id,sum(t.capacity)::integer total,sum(greatest(t.capacity-coalesce(r.n,0),0))::integer open
  from public.event_tasks t left join reserved r on r.task_id=t.id
  where t.event_id in (select id from upcoming) group by t.event_id
 ), volunteers as (
  select p.interests from public.profiles p join public.users u on u.id=p.user_id and u.role='volunteer'
 ), interest as (
  select c,count(*) n from volunteers v cross join lateral unnest(v.interests) c group by c
 ), cats as (
  select c from interest union select unnest(categories) from upcoming
 )
 select jsonb_build_object(
  'window_days',window_days,
  'generated_at',clock_timestamp(),
  'totals',jsonb_build_object(
   'events',(select count(*) from upcoming),
   'open_spots',(select coalesce(sum(s.open),0) from spots s),
   'total_spots',(select coalesce(sum(s.total),0) from spots s),
   'volunteers_with_interests',private.suppress_small((select count(*) from volunteers where cardinality(interests)>0)),
   'uncategorized_events',(select count(*) from upcoming where cardinality(categories)=0)
  ),
  'categories',coalesce((select jsonb_agg(jsonb_build_object(
    'category',cats.c,
    'interested',private.suppress_small(coalesce(i.n,0)),
    'events',(select count(*) from upcoming u where cats.c=any(u.categories)),
    'open_spots',(select coalesce(sum(s.open),0) from upcoming u join spots s on s.event_id=u.id where cats.c=any(u.categories)),
    'total_spots',(select coalesce(sum(s.total),0) from upcoming u join spots s on s.event_id=u.id where cats.c=any(u.categories))
   ) order by cats.c) from cats left join interest i on i.c=cats.c),'[]'::jsonb),
  'events',coalesce((select jsonb_agg(jsonb_build_object(
    'id',u.id,'title',u.title,'group_name',g.name,'categories',u.categories,'starts_at',u.starts_at,
    'city',u.city,'venue',u.venue,'address',u.address,'location',u.location,
    'open_spots',coalesce(s.open,0),'total_spots',coalesce(s.total,0)
   ) order by u.starts_at,u.id) from upcoming u join public.groups g on g.id=u.group_id left join spots s on s.event_id=u.id),'[]'::jsonb)
 ) into result;
 return result;
end $$;
revoke all on function public.app_community_needs(integer) from public;
grant execute on function public.app_community_needs(integer) to commonly_runtime;
