'use client';
/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { DateTime } from 'luxon';
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  Clock3,
  Plus,
  Save,
  Sparkle,
  Trash2,
  Users,
} from 'lucide-react';
import { useApp } from './provider';
import { Empty, PageHeading } from './events';
import { AuthRequired } from './screens';
import { LocationPicker } from './location-picker';
import { CauseFields } from './onboarding';
import { AccountDeletion } from './delete-account';
import { DeleteEventButton } from './event-delete';
import { eventPhase, eventDeletionReason, formatDate, hoursServed, initials } from '@/lib/domain';
import type { Event, Signup } from '@/lib/types';

export function ProfileForm() {
  const { data, busy, act, avatar } = useApp();
  const p = data.profile;
  return (
    <AuthRequired>
      {p && (
        <>
          <PageHeading
            eyebrow="ACCOUNT MANAGEMENT"
            title="Your profile"
            description="Some context about yourself."
          />
          <div className="profile-grid">
            <section className="panel">
              <div className="profile-photo-row">
                <span className="avatar large">
                  {p.avatar_path ? (
                    <img src={p.avatar_path} alt={`${p.display_name}'s profile`} />
                  ) : (
                    initials(p.display_name)
                  )}
                </span>
                <div>
                  <h2>{p.display_name}</h2>
                  <label className="upload-label">
                    <Camera size={16} /> Change photo
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      aria-label="Profile picture"
                      disabled={busy}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void avatar(file);
                      }}
                    />
                  </label>
                  <small className="muted">JPEG, PNG, or WebP · up to 2 MB</small>
                </div>
              </div>
              <form
                key={`${p.id}-${p.display_name}`}
                className="form-stack"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const form = new FormData(e.currentTarget);
                  await act('profile', {
                    ...Object.fromEntries(form),
                    interests: form.getAll('interests'),
                  });
                }}
              >
                <Field
                  label="Display name"
                  name="display_name"
                  defaultValue={p.display_name}
                  required
                  minLength={2}
                  maxLength={80}
                />
                <LocationPicker initial={p.location} legacyCity={p.city} />
                <label>
                  About me
                  <textarea
                    name="bio"
                    defaultValue={p.bio}
                    maxLength={1000}
                    rows={5}
                    placeholder="What brings you to volunteer?"
                  />
                </label>
                <Field
                  label="Skills (optional)"
                  name="skills"
                  defaultValue={p.skills ?? ''}
                  maxLength={300}
                />
                <CauseFields initial={p.interests} />
                <div className="form-actions">
                  <span className="status-tag">
                    {p.role === 'organization' ? 'Organization account' : 'Volunteer account'}
                  </span>
                  <button className="button" disabled={busy}>
                    <Save size={16} />
                    {busy ? 'Saving…' : 'Save profile'}
                  </button>
                </div>
              </form>
            </section>
            <section className="panel profile-impact">
              <span className="sparkle-box">
                <Clock3 aria-hidden="true" />
              </span>
              <p className="eyebrow">TIME WELL GIVEN</p>
              <strong className="hours-number">{hoursServed(data.signups, p.id).toFixed(1)}</strong>
              <h2>Hours served</h2>
              <p className="muted">
                Your hours update after an organizer verifies your attendance.
              </p>
              <div className="service-history">
                {data.signups
                  .filter((s) => s.volunteer_id === p.id && s.verified_minutes !== null)
                  .map((s) => (
                    <div key={s.id}>
                      <Check size={16} />
                      <span>{data.events.find((e) => e.id === s.event_id)?.title}</span>
                      <strong>{((s.verified_minutes ?? 0) / 60).toFixed(1)} h</strong>
                    </div>
                  ))}
              </div>
            </section>
          </div>
          <AccountDeletion />
        </>
      )}
    </AuthRequired>
  );
}
export function GroupForm() {
  const { data, busy, act } = useApp();
  const router = useRouter(),
    group = data.groups.find((g) => g.owner_id === data.profile?.id);
  return (
    <AuthRequired organization>
      <PageHeading
        eyebrow="A HOME FOR YOUR ORGANIZATION"
        title="My group"
        description="Help neighbors get to know your organization and the work you do."
      />
      <section className="panel form-panel">
        <div className="form-intro">
          <span className="group-logo">
            <Users size={30} />
          </span>
          <div>
            <h2>{group?.name ?? 'Start something meaningful'}</h2>
            <p className="muted">One group. A whole community of possibility.</p>
          </div>
        </div>
        <form
          className="form-stack"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            if (await act('group', { ...Object.fromEntries(form), causes: form.getAll('causes') }))
              router.push('/event-hub');
          }}
        >
          <Field
            label="Organization name"
            name="name"
            defaultValue={group?.name}
            required
            minLength={2}
          />
          <label>
            About your organization
            <textarea
              name="description"
              defaultValue={group?.description}
              required
              minLength={10}
              maxLength={2000}
              rows={5}
            />
          </label>
          <LocationPicker
            initial={group?.location}
            legacyCity={group?.city}
            label="Organization city / town"
          />
          <Field
            label="Public contact email (optional)"
            name="public_contact_email"
            type="email"
            defaultValue={group?.public_contact_email ?? ''}
            maxLength={254}
          />
          <CauseFields name="causes" initial={group?.causes} legend="Cause categories (optional)" />
          <Field
            label="Website (optional)"
            name="website_url"
            type="url"
            defaultValue={group?.website_url ?? ''}
            placeholder="https://"
          />
          <div className="form-actions">
            {group && (
              <Link className="text-link" href={`/groups/${group.slug}`}>
                View public group <ArrowRight size={16} />
              </Link>
            )}
            <button className="button" disabled={busy}>
              <Save size={16} />
              {busy ? 'Saving…' : group ? 'Save group' : 'Create group'}
            </button>
          </div>
        </form>
      </section>
      <AccountDeletion />
    </AuthRequired>
  );
}
export function EventForm({ event }: { event?: Event }) {
  const { data, busy, act } = useApp();
  const router = useRouter(),
    group = data.groups.find((g) => g.owner_id === data.profile?.id);
  const existing = data.tasks.filter((t) => t.event_id === event?.id);
  const [tasks, setTasks] = useState(
    existing.length
      ? existing.map((t) => ({ name: t.name, capacity: t.capacity, description: t.description }))
      : [
          {
            name: 'General volunteer',
            capacity: 8,
            description: 'A helping hand wherever it is needed.',
          },
        ],
  );
  const [interval, setInterval] = useState('0');
  const defaultStart = event
    ? DateTime.fromISO(event.starts_at).setZone(event.timezone).toFormat("yyyy-MM-dd'T'HH:mm")
    : DateTime.now()
        .setZone('America/New_York')
        .plus({ days: 7 })
        .set({ hour: 9, minute: 0 })
        .toFormat("yyyy-MM-dd'T'HH:mm");
  return (
    <AuthRequired organization>
      {!group ? (
        <Empty title="Create your group first">
          <Link className="button" href="/my-group">
            Set up my group
          </Link>
        </Empty>
      ) : (
        <>
          <Link className="back-link" href="/event-hub">
            <ArrowLeft size={16} /> Event hub
          </Link>
          {!event && (
            <PageHeading
              eyebrow="GOOD STARTS WITH AN INVITATION"
              title="Create an event"
              description="Give your community a reason to come together."
            />
          )}
          <form
            className="event-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const values = new FormData(e.currentTarget);
              const form = Object.fromEntries(values);
              if (
                await act(event ? 'update_event' : 'create_event', {
                  ...form,
                  categories: values.getAll('categories'),
                  tasks,
                  event_id: event?.id,
                  task_ids: existing.map((t) => t.id),
                  interval: event ? 0 : Number(interval),
                })
              )
                router.push(event ? `/events/${event.id}` : '/event-hub');
            }}
          >
            <section className="panel form-stack">
              <h2>The essentials</h2>
              <Field
                label="Event title"
                name="title"
                defaultValue={event?.title}
                placeholder="e.g. Community Pantry Packing"
                required
                minLength={3}
                maxLength={150}
              />
              <label>
                Description
                <textarea
                  name="description"
                  defaultValue={event?.description}
                  placeholder="What will volunteers do? Where should they meet?"
                  required
                  minLength={10}
                  maxLength={4000}
                  rows={5}
                />
              </label>
              <div className="form-two">
                <Field label="Venue" name="venue" defaultValue={event?.venue} required />
                <LocationPicker
                  initial={event ? event.location : group.location}
                  legacyCity={event?.city}
                  label="Event city / town"
                />
              </div>
              <CauseFields
                name="categories"
                initial={event?.categories}
                legend="Event categories (optional)"
              />
              <Field
                label="Address / meeting point"
                name="address"
                defaultValue={event?.address}
                required
              />
              <div className="form-two">
                <Field
                  label="Start date & time"
                  name="localStart"
                  type="datetime-local"
                  defaultValue={defaultStart}
                  required
                />
                <Field
                  label="Duration (minutes)"
                  name="duration"
                  type="number"
                  defaultValue={
                    event ? (Date.parse(event.ends_at) - Date.parse(event.starts_at)) / 60000 : 120
                  }
                  min={15}
                  max={720}
                  step={15}
                  required
                />
              </div>
              <label>
                Time zone
                <select name="timezone" defaultValue={event?.timezone ?? 'America/New_York'}>
                  {(event
                    ? [event.timezone]
                    : [
                        'America/New_York',
                        'America/Chicago',
                        'America/Denver',
                        'America/Los_Angeles',
                      ]
                  ).map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </label>
              <Field
                label="What to bring (separate items with commas)"
                name="resources"
                defaultValue={event?.resources_to_bring.join(', ')}
                placeholder="Closed-toe shoes, water bottle"
              />
              {event ? (
                <input type="hidden" name="count" value="1" />
              ) : (
                <div className="form-two">
                  <label>
                    Repeat
                    <select value={interval} onChange={(e) => setInterval(e.target.value)}>
                      <option value="0">One-time event</option>
                      <option value="1">Every week</option>
                      <option value="2">Every two weeks</option>
                    </select>
                  </label>
                  <Field
                    label="Number of occurrences"
                    name="count"
                    type="number"
                    min={interval === '0' ? 1 : 2}
                    max={12}
                    defaultValue={2}
                    readOnly={interval === '0'}
                  />
                </div>
              )}
              <p className="field-help">
                {event
                  ? 'Changes apply to this occurrence only.'
                  : 'Recurring events keep the same local time. Volunteers sign up for each date separately.'}
              </p>
            </section>
            <section className="panel form-stack">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">EVERYONE HAS A PART TO PLAY</p>
                  <h2>Volunteer tasks</h2>
                </div>
                <Users size={22} />
              </div>
              {tasks.map((t, i) => (
                <div className="task-editor" key={i}>
                  <div className="form-two">
                    <label>
                      Task name
                      <input
                        value={t.name}
                        readOnly={!!event}
                        required
                        minLength={2}
                        maxLength={100}
                        onChange={(e) =>
                          setTasks(
                            tasks.map((t, j) => (j === i ? { ...t, name: e.target.value } : t)),
                          )
                        }
                      />
                    </label>
                    <label>
                      Spots available
                      <input
                        type="number"
                        value={t.capacity}
                        min={existing[i]?.reserved || 1}
                        max={500}
                        required
                        onChange={(e) =>
                          setTasks(
                            tasks.map((t, j) =>
                              j === i ? { ...t, capacity: Number(e.target.value) } : t,
                            ),
                          )
                        }
                      />
                    </label>
                  </div>
                  <label>
                    Task description
                    <input
                      value={t.description}
                      readOnly={!!event}
                      maxLength={500}
                      onChange={(e) =>
                        setTasks(
                          tasks.map((t, j) =>
                            j === i ? { ...t, description: e.target.value } : t,
                          ),
                        )
                      }
                    />
                  </label>
                  {!event && tasks.length > 1 && (
                    <button
                      className="text-button danger"
                      type="button"
                      onClick={() => setTasks(tasks.filter((_, j) => j !== i))}
                    >
                      <Trash2 size={14} /> Remove task
                    </button>
                  )}
                </div>
              ))}
              {!event && tasks.length < 12 && (
                <button
                  className="button secondary"
                  type="button"
                  onClick={() => setTasks([...tasks, { name: '', capacity: 4, description: '' }])}
                >
                  <Plus size={16} /> Add task
                </button>
              )}
              <p className="field-help">
                Each volunteer reserves one task.{' '}
                {event
                  ? 'Capacity cannot fall below existing reservations. Task names and descriptions stay fixed after publishing.'
                  : 'We’ll stop accepting reservations when a task is full.'}
              </p>
            </section>
            <div className="form-actions">
              <Link className="text-link" href="/event-hub">
                Back to event hub
              </Link>
              <button className="button" disabled={busy}>
                {event ? <Save size={18} /> : <Plus size={18} />}
                {busy ? 'Saving…' : event ? 'Save changes' : 'Publish event'}
              </button>
            </div>
          </form>
        </>
      )}
    </AuthRequired>
  );
}
export function ManageEvent({ id }: { id: string }) {
  const { data, act, busy } = useApp();
  const [cancelOpen, setCancelOpen] = useState(false);
  const event = data.events.find((e) => e.id === id),
    group = data.groups.find((g) => g.id === event?.group_id);
  if (!event) return <Empty title="Event not found" />;
  if (!data.profile || group?.owner_id !== data.profile.id)
    return (
      <Empty title="You don’t manage this event">
        <Link className="button" href="/event-hub">
          Go to your event hub
        </Link>
      </Empty>
    );
  const phase = eventPhase(event),
    signups = data.signups.filter((s) => s.event_id === id && s.status === 'active');
  return (
    <>
      <PageHeading
        eyebrow="BRINGING GOOD TOGETHER"
        title={event.title}
        description={`${formatDate(event.starts_at, event.timezone, 'MMMM d, yyyy')} · ${event.venue}`}
        action={
          <Link className="button secondary" href={`/events/${id}`}>
            View event <ArrowRight size={16} />
          </Link>
        }
      />
      <section className="panel attendees">
        <div className="section-heading">
          <div>
            <p className="eyebrow">YOUR HELPING HANDS</p>
            <h2>Volunteers & attendance</h2>
          </div>
          <span className="status-tag">{signups.length} registered</span>
        </div>
        <p className="muted">
          {phase === 'previous'
            ? 'Record minutes actually served. Saving again replaces the previous entry.'
            : 'Attendance verification becomes available after the event ends.'}
        </p>
        {signups.length ? (
          signups.map((s) => <Attendance key={s.id} signup={s} event={event} />)
        ) : (
          <p className="empty-inline">
            No reservations yet. Share your event to invite volunteers.
          </p>
        )}
      </section>
      {phase === 'upcoming' && (
        <section
          id="edit-event"
          className="event-editor-section"
          aria-labelledby="edit-event-heading"
        >
          <h2 id="edit-event-heading">Edit event</h2>
          <EventForm event={event} />
        </section>
      )}
      {['upcoming', 'ongoing'].includes(phase) && (
        <section className="panel cancel-panel">
          <h3>Plans changed?</h3>
          <p className="muted">
            Cancellation closes sign-ups and messages while keeping the event’s history.
          </p>
          {cancelOpen ? (
            <div className="form-actions">
              <strong>Cancel this occurrence?</strong>
              <button className="button secondary" onClick={() => setCancelOpen(false)}>
                Keep event
              </button>
              <button
                className="button danger-button"
                disabled={busy}
                onClick={async () => {
                  await act('cancel', { event_id: id });
                  setCancelOpen(false);
                }}
              >
                Confirm cancellation
              </button>
            </div>
          ) : (
            <button className="text-button danger" onClick={() => setCancelOpen(true)}>
              Cancel event
            </button>
          )}
        </section>
      )}
      <section className="panel cancel-panel">
        <h3>Delete event</h3>
        <p className="muted">
          {eventDeletionReason(event, data.signups) ??
            'Permanently remove this occurrence, its signups, tasks, and messages.'}
        </p>
        <DeleteEventButton event={event} returnToHub />
      </section>
    </>
  );
}
function Attendance({ signup, event }: { signup: Signup; event: Event }) {
  const { data, act, busy } = useApp();
  const [minutes, setMinutes] = useState(signup.verified_minutes ?? 0);
  return (
    <div className="attendee-row">
      <div>
        <strong>{signup.display_name ?? 'Volunteer'}</strong>
        <p>{data.tasks.find((t) => t.id === signup.task_id)?.name}</p>
      </div>
      {eventPhase(event) === 'previous' ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void act('verify', { signup_id: signup.id, minutes });
          }}
        >
          <label>
            Minutes served
            <input
              aria-label={`Minutes served by ${signup.display_name}`}
              type="number"
              min={0}
              max={(Date.parse(event.ends_at) - Date.parse(event.starts_at)) / 60000}
              required
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
            />
          </label>
          <button className="button small" disabled={busy}>
            <Check size={15} /> {signup.verified_minutes === null ? 'Verify' : 'Update'}
          </button>
        </form>
      ) : (
        <span className="status-tag">Registered</span>
      )}
    </div>
  );
}
export function AuthForm({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const { demo, busy, login } = useApp(),
    router = useRouter();
  const [role, setRole] = useState('volunteer'),
    signup = mode === 'sign-up';
  return (
    <div className="auth-layout">
      <section className="panel auth-panel" aria-labelledby="auth-title">
        <h1 id="auth-title">{signup ? 'Create your account' : 'Welcome back'}</h1>
        <p className="muted">
          {signup
            ? 'Connect with local volunteers and organizations.'
            : 'Sign in to access your events and community.'}
        </p>
        {demo ? (
          <>
            <p className="inline-alert">
              Demo mode: no email is sent and no password is stored.{' '}
              {signup
                ? 'Create a local demo profile.'
                : 'Choose a role to explore a sample account.'}
            </p>
            <form
              className="form-stack"
              onSubmit={async (e) => {
                e.preventDefault();
                const fields = Object.fromEntries(new FormData(e.currentTarget)) as Record<
                  string,
                  string
                >;
                if (
                  await login(mode, {
                    ...fields,
                    role,
                    display_name: fields.display_name || 'Community member',
                  })
                )
                  router.push(
                    signup ? '/onboarding' : role === 'organization' ? '/event-hub' : '/browse',
                  );
              }}
            >
              {!signup && (
                <fieldset className="role-picker">
                  <legend>Account type</legend>
                  <button
                    type="button"
                    aria-pressed={role === 'volunteer'}
                    className={role === 'volunteer' ? 'selected' : ''}
                    onClick={() => setRole('volunteer')}
                  >
                    <Sparkle size={18} /> Volunteer
                  </button>
                  <button
                    type="button"
                    aria-pressed={role === 'organization'}
                    className={role === 'organization' ? 'selected' : ''}
                    onClick={() => setRole('organization')}
                  >
                    <Users size={18} /> Organization
                  </button>
                </fieldset>
              )}
              {signup && (
                <Field
                  label="Your name"
                  name="display_name"
                  required
                  minLength={2}
                  maxLength={80}
                  autoComplete="name"
                />
              )}
              <button className="button full" disabled={busy}>
                {busy ? 'Please wait...' : signup ? 'Create account' : 'Sign in'}{' '}
                <ArrowRight size={17} />
              </button>
            </form>
          </>
        ) : (
          <a
            className="button full"
            href={signup ? '/auth/login?screen_hint=signup' : '/auth/login'}
          >
            {signup ? 'Create account' : 'Sign in'} with Auth0 <ArrowRight size={17} />
          </a>
        )}
        <p className="auth-switch">
          {signup ? 'Already have an account?' : 'New to Turnout?'}{' '}
          <Link className="text-link" href={signup ? '/sign-in' : '/sign-up'}>
            {signup ? 'Sign in' : 'Create an account'}
          </Link>
        </p>
      </section>
    </div>
  );
}

function Field({
  label,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label>
      {label}
      <input {...props} />
    </label>
  );
}
