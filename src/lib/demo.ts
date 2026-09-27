import {
  eventSchema,
  groupSchema,
  occurrences,
  profileSchema,
  onboardingSchema,
  deleteAccountSchema,
  deleteEventSchema,
  eventDeletionReason,
} from './domain';
import { demoLocation } from './location';
import type { DemoState, Event, Signup } from './types';
export function demoCommand(
  previous: DemoState,
  kind: string,
  input: Record<string, unknown>,
): DemoState {
  const state = structuredClone(previous),
    actor = state.profile;
  if (kind === 'onboard') {
    if (actor || !state.onboarding || !state.pendingUserId)
      throw new Error('Sign in to complete your profile.');
    const value = onboardingSchema.parse(input);
    const location = demoLocation(value.location_id);
    const profile = {
      id: state.pendingUserId,
      role: value.role,
      display_name: value.display_name,
      city: location.city,
      location,
      bio: value.bio,
      interests: value.interests,
      skills: value.skills,
      avatar_path: null,
    };
    state.profiles.push(profile);
    state.profile = profile;
    if (value.role === 'organization') {
      state.groups.push({
        id: crypto.randomUUID(),
        owner_id: profile.id,
        name: value.organization_name,
        slug: `${value.organization_name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${crypto.randomUUID().slice(0, 8)}`,
        description: value.organization_description,
        city: location.city,
        location,
        website_url: value.website_url || null,
        public_contact_email: value.public_contact_email || null,
        causes: value.interests,
      });
    }
    delete state.onboarding;
    delete state.pendingUserId;
    return state;
  }
  if (!actor) throw new Error('Sign in to continue.');
  const group = state.groups.find((g) => g.owner_id === actor.id);
  if (kind === 'delete_account') {
    deleteAccountSchema.parse(input);
    if (!state.profiles.some((profile) => profile.id === actor.id))
      throw new Error('Account profile is missing.');
    const now = new Date().toISOString();
    const ownedGroups = state.groups.filter((item) => item.owner_id === actor.id);
    const ownedIds = new Set(ownedGroups.map((item) => item.id));
    for (const event of state.events) {
      if (ownedIds.has(event.group_id) && Date.parse(event.ends_at) > Date.now())
        event.status = 'cancelled';
    }
    for (const owned of ownedGroups) {
      Object.assign(owned, {
        owner_id: null,
        archived_at: now,
        description: 'This organization is no longer active on Turnout.',
        city: '',
        location: null,
        website_url: null,
        public_contact_email: null,
        causes: [],
      });
    }
    for (const signup of state.signups)
      if (signup.verified_by === actor.id) signup.verified_by = null;
    state.comments = state.comments.filter((comment) => comment.author_id !== actor.id);
    state.signups = state.signups.filter((signup) => signup.volunteer_id !== actor.id);
    state.profiles = state.profiles.filter((profile) => profile.id !== actor.id);
    state.profile = null;
    delete state.onboarding;
    delete state.pendingUserId;
  } else if (kind === 'profile') {
    const parsed = profileSchema.parse(input);
    const { location_id, location_token: _, ...fields } = parsed;
    const location = demoLocation(location_id);
    const value = { ...fields, location, city: location.city };
    Object.assign(actor, value);
    Object.assign(
      state.profiles.find((p) => p.id === actor.id)!,
      value,
    );
  } else if (kind === 'group') {
    if (actor.role !== 'organization') throw new Error('Organization account required.');
    const { location_id, location_token: _, ...fields } = groupSchema.parse(input);
    const location = demoLocation(location_id);
    const value = { ...fields, location, city: location.city };
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
      city: demoLocation(form.location_id).city,
      location: demoLocation(form.location_id),
      timezone: form.timezone,
      categories: form.categories,
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
    if (kind === 'delete_event') {
      deleteEventSchema.parse(input);
      if (actor.role !== 'organization' || !owns) throw new Error('You do not manage this event.');
      const reason = eventDeletionReason(event, state.signups);
      if (reason) throw new Error(reason);
      state.comments = state.comments.filter((comment) => comment.event_id !== event.id);
      state.signups = state.signups.filter((signup) => signup.event_id !== event.id);
      state.tasks = state.tasks.filter((task) => task.event_id !== event.id);
      state.events = state.events.filter((item) => item.id !== event.id);
      if (event.series_id && !state.events.some((item) => item.series_id === event.series_id))
        state.series = state.series.filter((series) => series.id !== event.series_id);
    } else if (kind === 'join' || kind === 'withdraw') {
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
