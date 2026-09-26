-- Extend the shared category list without changing existing selections.
alter table public.profiles drop constraint profiles_interests_check;
alter table public.profiles add constraint profiles_interests_check check (
 interests <@ array['Food access','Education','Environment','Health','Housing','Gift-making','Clothing','Letter writing','Religious','Campaign','Community support']
);
alter table public.groups drop constraint groups_causes_check;
alter table public.groups add constraint groups_causes_check check (
 causes <@ array['Food access','Education','Environment','Health','Housing','Gift-making','Clothing','Letter writing','Religious','Campaign','Community support']
);
-- Existing events remain uncategorized until an organizer explicitly selects categories.
alter table public.events add column categories text[] not null default '{}' check (
 categories <@ array['Food access','Education','Environment','Health','Housing','Gift-making','Clothing','Letter writing','Religious','Campaign','Community support']
);

-- Keep the existing authorization, location checks, event locks, and recurrence transaction.
alter function public.app_command(text,jsonb) set schema private;
alter function private.app_command(text,jsonb) rename to app_command_v2;
revoke all on function private.app_command_v2(text,jsonb) from public,commonly_runtime;

create function public.app_command(kind text, payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb; event_id uuid; series uuid; selected text[];
begin
 result:=private.app_command_v2(kind,payload);
 if kind in ('create_event','update_event') and payload ? 'categories' then
  if jsonb_typeof(payload->'categories') is distinct from 'array' then
   raise exception 'Select valid event categories.';
  end if;
  selected:=array(select jsonb_array_elements_text(payload->'categories'));
  event_id:=(result->>'id')::uuid;
  if kind='create_event' then
   select series_id into series from public.events where id=event_id;
   update public.events set categories=selected
    where id=event_id or (series is not null and series_id=series);
  else
   update public.events set categories=selected where id=event_id;
  end if;
 end if;
 -- Old callers omitting categories preserve existing selections. An explicit [] clears them.
 return result;
end $$;
revoke all on function public.app_command(text,jsonb) from public;
grant execute on function public.app_command(text,jsonb) to commonly_runtime;
