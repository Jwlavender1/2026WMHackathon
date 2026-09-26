-- Additive migration. Existing city strings are preserved, never assigned a guessed state.
create function private.valid_location(value jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
begin
 return coalesce(
  jsonb_typeof(value)='object'
  and value->>'provider' in ('geoapify','demo')
  and length(value->>'id') between 1 and 512
  and length(trim(value->>'city')) between 1 and 100
  and value->>'country_code'='US'
  and value->>'state_code' in ('AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','PR','VI','GU','AS','MP')
  and jsonb_typeof(value->'latitude')='number' and (value->>'latitude')::numeric between -90 and 90
  and jsonb_typeof(value->'longitude')='number' and (value->>'longitude')::numeric between -180 and 180,
 false);
exception when others then return false;
end $$;
alter table public.profiles add column location jsonb check(location is null or private.valid_location(location));
alter table public.profiles add column interests text[] not null default '{}' check(interests <@ array['Food access','Education','Environment','Health','Housing','Community support']);
alter table public.profiles add column skills text not null default '' check(length(skills)<=300);
alter table public.groups add column location jsonb check(location is null or private.valid_location(location));
alter table public.groups add column causes text[] not null default '{}' check(causes <@ array['Food access','Education','Environment','Health','Housing','Community support']);
alter table public.groups add column public_contact_email text check(public_contact_email is null or (length(public_contact_email)<=254 and public_contact_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'));
alter table public.events add column location jsonb check(location is null or private.valid_location(location));
grant select(location,causes,public_contact_email) on public.groups to commonly_runtime;

-- Preserve existing authorization and capacity checks behind a private boundary.
alter function public.app_command(text,jsonb) set schema private;
alter function private.app_command(text,jsonb) rename to app_command_v1;
revoke all on function private.app_command_v1(text,jsonb) from public,commonly_runtime;
create function public.app_command(kind text, payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.actor_id(); result jsonb; loc jsonb; actor_role text; eid uuid; series uuid;
begin
 if actor is null then raise exception 'Sign in to continue.' using errcode='28000'; end if;
 select role into actor_role from public.users where id=actor for update;
 if not found then raise exception 'Account profile is missing.'; end if;
 if kind='onboard' and actor_role is not null then raise exception 'Your account role is already set.'; end if;
 if kind<>'onboard' and actor_role is null then raise exception 'Complete your profile first.'; end if;
 if kind in ('onboard','profile','group','create_event','update_event') then
  -- Keep the currently deployed server's city-only contract working during rollout.
  -- The new server requires a signed selection before calling this function.
  if not (payload ? 'location') and payload ? 'city' then
   result:=private.app_command_v1(kind,payload);
   -- An old form can change city text but cannot establish a new verified location.
   -- Preserve structured locations on unchanged cities; clear them on city changes.
   if kind='profile' then
    update public.profiles set location=null where user_id=actor and location is not null and city is distinct from location->>'city';
   elsif kind='group' then
    update public.groups set location=null where id=(result->>'id')::uuid and location is not null and city is distinct from location->>'city';
   elsif kind='update_event' then
    update public.events set location=null where id=(payload->>'event_id')::uuid and location is not null and city is distinct from location->>'city';
   end if;
   return result;
  end if;
  loc:=payload->'location';
  if not private.valid_location(loc) then raise exception 'Select a city from the suggestions.'; end if;
  payload:=payload||jsonb_build_object('city',loc->>'city');
 end if;
 result:=private.app_command_v1(kind,payload);
 if kind in ('onboard','profile') then
  update public.profiles set location=loc,bio=coalesce(payload->>'bio',''),
   interests=array(select jsonb_array_elements_text(coalesce(payload->'interests','[]'))),
   skills=coalesce(payload->>'skills','') where user_id=actor;
  if kind='onboard' and payload->>'role'='organization' then
   result:=private.app_command_v1('group',jsonb_build_object(
    'name',payload->>'organization_name','description',payload->>'organization_description',
    'city',loc->>'city','website_url',payload->>'website_url'));
   update public.groups set location=loc,
    causes=array(select jsonb_array_elements_text(coalesce(payload->'interests','[]'))),
    public_contact_email=nullif(payload->>'public_contact_email','') where id=(result->>'id')::uuid;
   result:=jsonb_build_object('id',actor);
  end if;
 elsif kind='group' then
  update public.groups set location=loc,
   causes=array(select jsonb_array_elements_text(coalesce(payload->'causes','[]'))),
   public_contact_email=nullif(payload->>'public_contact_email','') where id=(result->>'id')::uuid;
 elsif kind='create_event' then
  eid:=(result->>'id')::uuid;
  select series_id into series from public.events where id=eid;
  update public.events set location=loc where id=eid or (series is not null and series_id=series);
 elsif kind='update_event' then
  update public.events set location=loc where id=(payload->>'event_id')::uuid;
 end if;
 return result;
end $$;
revoke all on function public.app_command(text,jsonb) from public;
grant execute on function public.app_command(text,jsonb) to commonly_runtime;

alter function public.app_snapshot() set schema private;
alter function private.app_snapshot() rename to app_snapshot_v1;
revoke all on function private.app_snapshot_v1() from public,commonly_runtime;
create function public.app_snapshot() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare snapshot jsonb:=private.app_snapshot_v1(); extra jsonb;
begin
 if snapshot->'profile' <> 'null'::jsonb then
  select jsonb_build_object('location',location,'interests',interests,'skills',skills) into extra
   from public.profiles where user_id=private.actor_id();
  snapshot:=snapshot||jsonb_build_object('profile',(snapshot->'profile')||extra);
 end if;
 return snapshot;
end $$;
revoke all on function public.app_snapshot() from public;
grant execute on function public.app_snapshot() to commonly_runtime;
revoke all on function private.valid_location(jsonb) from public;
grant execute on function private.valid_location(jsonb) to commonly_runtime;
