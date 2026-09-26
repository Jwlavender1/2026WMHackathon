import { eventSchema, groupSchema, occurrences, profileSchema } from './domain';
import type { DemoState, Event, Signup } from './types';
export function demoCommand(
  previous: DemoState,
  kind: string,
  input: Record<string, unknown>,
): DemoState {
  const state = structuredClone(previous),
    actor = state.profile;
  if (!actor) throw new Error('Sign in to continue.');
  const group = state.groups.find((g) => g.owner_id === actor.id);
  if (kind === 'profile') {
    const value = profileSchema.parse(input);
    Object.assign(actor, value);
    Object.assign(
      state.profiles.find((p) => p.id === actor.id)!,
      value,
    );
  } else if (kind === 'group') {
    if (actor.role !== 'organization') throw new Error('Organization account required.');
    const value = groupSchema.parse(input);
    if (group) Object.assign(group, value);
    else
      state.groups.push({
        ...value,
        id: crypto.randomUUID(),
        owner_id: actor.id,
        slug: `${value.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${crypto.randomUUID().slice(0, 8)}`,
      });
  } else if (kind === 'create_event' || kind === 'update_event') {
    if (!group) throw new Error('Create your organization group first.');
    const form = eventSchema.parse(input),
      dates = occurrences(form),
      seriesId = form.interval ? crypto.randomUUID() : null;
    const details = {
      title: form.title,
      description: form.description,
      venue: form.venue,
      address: form.address,
      city: form.city,
      timezone: form.timezone,
      resources_to_bring: form.resources
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    };
    if (kind === 'create_event') {
      if (seriesId)
        state.series.push({
          id: seriesId,
          group_id: group.id,
          frequency: 'weekly',
          interval_weeks: form.interval,
          occurrence_count: form.count,
          timezone: form.timezone,
          first_local_start: form.localStart,
          duration_minutes: form.duration,
        });
      dates.forEach((date, i) => {
        const event: Event = {
          ...details,
          ...date,
          id: crypto.randomUUID(),
          group_id: group.id,
          series_id: seriesId,
          occurrence_index: seriesId ? i : null,
          status: 'published',
        };
        state.events.push(event);
        form.tasks.forEach((t) =>
          state.tasks.push({ ...t, id: crypto.randomUUID(), event_id: event.id, reserved: 0 }),
        );
      });
    } else {
      const event = state.events.find((e) => e.id === input.event_id && e.group_id === group.id);
      if (!event || Date.parse(event.starts_at) <= Date.now() || event.status === 'cancelled')
        throw new Error('Only your future published events can be edited.');
      Object.assign(event, details, dates[0]);
      form.tasks.forEach((t, i) => {
        const task = state.tasks.find(
          (t) => t.id === (input.task_ids as string[])[i] && t.event_id === event.id,
        );
        if (!task || t.capacity < task.reserved)
          throw new Error('Capacity cannot fall below reservations.');
        task.capacity = t.capacity;
      });
    }
  } else {
    const signup =
      kind === 'verify' ? state.signups.find((s) => s.id === input.signup_id) : undefined;
    const comment =
      kind === 'hide_comment' ? state.comments.find((c) => c.id === input.comment_id) : undefined;
    const event = state.events.find(
      (e) => e.id === (signup?.event_id ?? comment?.event_id ?? input.event_id),
    );
    if (!event) throw new Error('Event not found.');
    const owns = group?.id === event.group_id,
      mine = state.signups.find((s) => s.event_id === event.id && s.volunteer_id === actor.id),
      readable = owns || mine?.status === 'active';
    if (kind === 'join' || kind === 'withdraw') {
      if (actor.role !== 'volunteer') throw new Error('Volunteer account required.');
      if (event.status === 'cancelled' || Date.parse(event.starts_at) <= Date.now())
        throw new Error('Reservations are closed.');
      if (kind === 'withdraw') {
        if (mine) mine.status = 'withdrawn';
      } else {
        if (mine?.status === 'active') {
          if (mine.task_id === input.task_id) return state;
          throw new Error('Withdraw your current reservation first.');
        }
        const task = state.tasks.find((t) => t.id === input.task_id && t.event_id === event.id);
        if (!task || task.reserved >= task.capacity) throw new Error('This task is full.');
        if (mine) Object.assign(mine, { task_id: task.id, status: 'active' });
        else
          state.signups.push({
            id: crypto.randomUUID(),
            event_id: event.id,
            task_id: task.id,
            volunteer_id: actor.id,
            status: 'active',
            verified_minutes: null,
            verified_at: null,
            verified_by: null,
            display_name: actor.display_name,
          });
      }
    } else if (kind === 'verify') {
      const minutes = Number(input.minutes);
      if (!owns || !signup || signup.status !== 'active')
        throw new Error('You cannot verify this attendance.');
      if (Date.parse(event.ends_at) > Date.now() || event.status === 'cancelled')
        throw new Error('Verify attendance after the event ends.');
      if (
        !Number.isInteger(minutes) ||
        minutes < 0 ||
        minutes > (Date.parse(event.ends_at) - Date.parse(event.starts_at)) / 60000
      )
        throw new Error('Minutes must be within the event duration.');
      Object.assign(signup, {
        verified_minutes: minutes,
        verified_at: new Date().toISOString(),
        verified_by: actor.id,
      } satisfies Partial<Signup>);
    } else if (kind === 'cancel') {
      if (!owns || Date.parse(event.ends_at) <= Date.now())
        throw new Error('Only your future or ongoing events can be cancelled.');
      event.status = 'cancelled';
    } else if (kind === 'comment') {
      const body = String(input.body ?? '').trim();
      if (!readable) throw new Error('Reserve a task to join this conversation.');
      if (event.status === 'cancelled' || Date.now() > Date.parse(event.ends_at) + 86400000)
        throw new Error('This conversation is read-only.');
      if (!body || body.length > 2000) throw new Error('Write a message of 1–2,000 characters.');
      state.comments.push({
        id: crypto.randomUUID(),
        event_id: event.id,
        author_id: actor.id,
        display_name: actor.display_name,
        body,
        created_at: new Date().toISOString(),
        hidden_at: null,
      });
    } else if (kind === 'hide_comment') {
      if (!readable || !comment || (!owns && comment.author_id !== actor.id))
        throw new Error('You cannot hide this message.');
      comment.hidden_at = new Date().toISOString();
      comment.body = '';
    } else throw new Error('Unknown operation.');
  }
  state.tasks.forEach(
    (t) =>
      (t.reserved = state.signups.filter(
        (s) => s.task_id === t.id && s.status === 'active',
      ).length),
  );
  return state;
}
