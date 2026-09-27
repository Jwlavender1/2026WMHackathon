-- Delete a single occurrence. Completed/ongoing events and verified attendance stay intact.
create function public.app_delete_event(event_id uuid, confirmation boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.actor_id(); actor_role text; ev public.events;
begin
 if actor is null then raise exception 'Sign in to continue.' using errcode='28000'; end if;
 if confirmation is distinct from true then raise exception 'Confirm event deletion first.'; end if;
 select role into actor_role from public.users where id=actor for update;
 if actor_role is distinct from 'organization' then raise exception 'Organization account required.' using errcode='42501'; end if;
 -- Match the event-first locks used for reservation, editing, cancellation, and attendance.
 select * into ev from public.events where id=event_id for update;
 if not found then raise exception 'Event not found.'; end if;
 if not private.owns_event(ev.id) then raise exception 'You do not manage this event.' using errcode='42501'; end if;
 if exists(select 1 from public.signups s where s.event_id=ev.id and s.verified_minutes is not null) then
  raise exception 'Events with verified attendance must remain in service history.';
 end if;
 if ev.starts_at<=clock_timestamp() then raise exception 'Events that have started must remain in service history.'; end if;
 delete from public.event_comments c where c.event_id=ev.id;
 delete from public.signups s where s.event_id=ev.id;
 delete from public.event_tasks t where t.event_id=ev.id;
 delete from public.events e where e.id=ev.id;
 -- Preserve sibling occurrences and remove a series only after its last occurrence is gone.
 delete from public.event_series s where s.id=ev.series_id
  and not exists(select 1 from public.events e where e.series_id=s.id);
 return jsonb_build_object('id',ev.id);
end $$;
revoke all on function public.app_delete_event(uuid,boolean) from public;
grant execute on function public.app_delete_event(uuid,boolean) to commonly_runtime;
