'use client';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  Clock3,
  MapPin,
  MessageSquare,
  Repeat2,
  Send,
  Share2,
  Trash2,
  Users,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useApp } from './provider';
import { eventPhase, formatDate, initials } from '@/lib/domain';
import type { Event } from '@/lib/types';
import { shortLocation } from '@/lib/location';

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <CalendarDays />
      </span>
      <h2>{title}</h2>
      {children}
    </div>
  );
}
export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {description && <p className="muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
export function EventCard({ event }: { event: Event }) {
  const { data } = useApp();
  const group = data.groups.find((g) => g.id === event.group_id),
    tasks = data.tasks.filter((t) => t.event_id === event.id),
    count = tasks.reduce((a, t) => a + t.capacity - t.reserved, 0),
    joined = data.signups.some(
      (s) =>
        s.event_id === event.id && s.volunteer_id === data.profile?.id && s.status === 'active',
    );
  return (
    <article className="event-card">
      <div className="event-card-body">
        {group && (
          <Link className="organizer" href={`/groups/${group.slug}`}>
            {group.name}
          </Link>
        )}
        <Link className="card-title" href={`/events/${event.id}`}>
          <h3>{event.title}</h3>
        </Link>
        <div className="event-meta">
          <span>
            <MapPin size={16} aria-hidden="true" />
            {shortLocation(event)}
          </span>
          <span>
            <CalendarDays size={16} aria-hidden="true" />
            <time dateTime={event.starts_at}>
              {formatDate(event.starts_at, event.timezone, 'ccc, MMM d, yyyy')}
            </time>
          </span>
          <span>
            <Clock3 size={16} aria-hidden="true" />
            {formatDate(event.starts_at, event.timezone, 'h:mm a')} –{' '}
            {formatDate(event.ends_at, event.timezone, 'h:mm a ZZZZ')}
          </span>
        </div>
        <div className="card-footer">
          <span className="event-availability">
            <span>
              {eventPhase(event) === 'upcoming'
                ? `${count} spots open`
                : eventPhase(event) === 'previous'
                  ? 'Completed'
                  : eventPhase(event) === 'cancelled'
                    ? 'Cancelled'
                    : 'Happening now'}
            </span>
            {joined && (
              <span className="event-going">
                <Check size={14} aria-hidden="true" /> Going
              </span>
            )}
          </span>
          {event.series_id ? (
            <span className="recurring">
              <Repeat2 size={14} /> Recurring
            </span>
          ) : (
            <ArrowRight size={17} />
          )}
        </div>
      </div>
    </article>
  );
}
export function EventGrid({ events }: { events: Event[] }) {
  return (
    <div className="event-grid">
      {events.map((e) => (
        <EventCard key={e.id} event={e} />
      ))}
    </div>
  );
}
export function EventDetail({ id }: { id: string }) {
  const { data, act, busy, setNotice } = useApp();
  const event = data.events.find((e) => e.id === id);
  if (!event)
    return (
      <Empty title="Event not found">
        <Link className="button" href="/browse">
          Discover events
        </Link>
      </Empty>
    );
  const group = data.groups.find((g) => g.id === event.group_id),
    owns = group?.owner_id === data.profile?.id && !!data.profile,
    tasks = data.tasks.filter((t) => t.event_id === id),
    signup = data.signups.find(
      (s) => s.event_id === id && s.volunteer_id === data.profile?.id && s.status === 'active',
    ),
    phase = eventPhase(event);
  return (
    <>
      <Link href="/browse" className="back-link">
        <ArrowLeft size={16} /> All opportunities
      </Link>
      <div className="detail-cover">
        <div>
          {!!event.categories?.length && (
            <p className="event-categories">{event.categories.join(' \u00b7 ')}</p>
          )}
          <h1>{event.title}</h1>
          <Link href={`/groups/${group?.slug}`}>
            {group?.name} <ArrowRight size={15} />
          </Link>
        </div>
      </div>
      <div className="detail-grid">
        <div>
          <section className="panel">
            <p className="eyebrow">A LITTLE TIME. A REAL DIFFERENCE.</p>
            <h2>About this opportunity</h2>
            <p className="body-copy">{event.description}</p>
            <div className="detail-facts">
              <div>
                <CalendarDays />
                <span>
                  <strong>
                    {formatDate(event.starts_at, event.timezone, 'cccc, MMMM d, yyyy')}
                  </strong>
                  <small>
                    {formatDate(event.starts_at, event.timezone, 'h:mm a')} –{' '}
                    {formatDate(event.ends_at, event.timezone, 'h:mm a ZZZZ')} · {event.timezone}
                  </small>
                </span>
              </div>
              <div>
                <MapPin />
                <span>
                  <strong>{event.venue}</strong>
                  <small>
                    {event.address} · {shortLocation(event)}
                  </small>
                </span>
              </div>
              {event.series_id && (
                <div>
                  <Repeat2 />
                  <span>
                    <strong>Part of a recurring series</strong>
                    <small>
                      Reserve each date separately. This is occurrence{' '}
                      {(event.occurrence_index ?? 0) + 1}.
                    </small>
                  </span>
                </div>
              )}
            </div>
            <h3>What to bring</h3>
            <div className="resource-list">
              {event.resources_to_bring.length ? (
                event.resources_to_bring.map((r) => (
                  <span key={r}>
                    <Check size={15} />
                    {r}
                  </span>
                ))
              ) : (
                <span>Just yourself. Supplies are provided.</span>
              )}
            </div>
          </section>
          <EventThread event={event} allowed={Boolean(owns || signup)} />
        </div>
        <aside>
          <section className="panel signup-panel">
            <p className="eyebrow">SHOW UP FOR SOMETHING GOOD</p>
            <h2>{signup ? 'You’re on the list!' : 'Find your place'}</h2>
            <p className="muted">
              {signup
                ? 'Your time makes a difference. We’re glad you’re here.'
                : 'Choose a task and lend a hand.'}
            </p>
            {phase === 'cancelled' && (
              <div className="inline-alert">This event has been cancelled.</div>
            )}
            {tasks.map((t) => (
              <div className="task-option" key={t.id}>
                <div>
                  <strong>{t.name}</strong>
                  <p>{t.description}</p>
                  <small>
                    <Users size={13} /> {t.capacity - t.reserved} of {t.capacity} spots open
                  </small>
                </div>
                {signup?.task_id === t.id ? (
                  <span className="status-tag">
                    <Check size={14} /> Your task
                  </span>
                ) : !signup && phase === 'upcoming' && data.profile?.role === 'volunteer' ? (
                  <button
                    disabled={busy || t.reserved >= t.capacity}
                    className="button small"
                    onClick={() => void act('join', { event_id: id, task_id: t.id })}
                  >
                    {t.reserved >= t.capacity ? 'Full' : 'Join'}
                  </button>
                ) : null}
              </div>
            ))}
            {!data.profile && phase === 'upcoming' && (
              <Link className="button full" href="/sign-in">
                Sign in to volunteer <ArrowRight size={16} />
              </Link>
            )}
            {signup && phase === 'upcoming' && (
              <button
                disabled={busy}
                className="text-button danger"
                onClick={() => void act('withdraw', { event_id: id })}
              >
                Withdraw reservation
              </button>
            )}
            {owns && (
              <Link className="button full" href={`/event-hub/${id}/manage`}>
                Manage this event
              </Link>
            )}
            <button
              className="button secondary full"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(window.location.href);
                  setNotice('Event link copied.');
                } catch {
                  setNotice('Copy the event URL from your address bar to share.');
                }
              }}
            >
              <Share2 size={16} /> Share opportunity
            </button>
          </section>
          <p className="small-note">
            Every helping hand counts. Thank you for being part of your community.
          </p>
        </aside>
      </div>
    </>
  );
}
function EventThread({ event, allowed }: { event: Event; allowed: boolean }) {
  const { data, demo, act, busy, refresh } = useApp();
  const [body, setBody] = useState(''),
    [connection, setConnection] = useState('Connecting…'),
    [limit, setLimit] = useState(50);
  const owns = data.groups.some((g) => g.id === event.group_id && g.owner_id === data.profile?.id),
    comments = data.comments
      .filter((c) => c.event_id === event.id)
      .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
  useEffect(() => {
    if (demo || !allowed) return;
    let stopped = false,
      inFlight = false;
    const update = async () => {
      if (stopped || inFlight || document.hidden) return;
      inFlight = true;
      const ok = await refresh();
      if (!stopped)
        setConnection(ok ? 'Updates every 5 seconds' : 'Connection interrupted · use refresh');
      inFlight = false;
    };
    const timer = setInterval(() => void update(), 5000);
    void update();
    document.addEventListener('visibilitychange', update);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', update);
    };
  }, [demo, allowed, event.id, refresh]);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  const writable = event.status === 'published' && now < Date.parse(event.ends_at) + 86400000;
  return (
    <section className="panel thread">
      <div className="section-heading">
        <div>
          <p className="eyebrow">BETTER TOGETHER</p>
          <h2>Event conversation</h2>
        </div>
        <MessageSquare size={22} />
      </div>
      {!allowed ? (
        <p className="muted">
          Reserve a task to join the conversation and coordinate with your group.
        </p>
      ) : (
        <>
          <div className="thread-status">
            <span>
              <span className="live-dot" />
              {demo ? 'Demo conversation' : connection}
            </span>
            <button className="text-button" onClick={() => void refresh()}>
              Refresh
            </button>
          </div>
          {comments.length > limit && (
            <button className="text-button" onClick={() => setLimit((n) => n + 50)}>
              Show earlier messages
            </button>
          )}
          <div className="comments">
            {comments.slice(-limit).map((c) => (
              <div className="comment" key={c.id}>
                <span className="avatar tiny">{initials(c.display_name)}</span>
                <div>
                  <div className="comment-heading">
                    <strong>{c.display_name}</strong>
                    <time>{formatDate(c.created_at, event.timezone, 'MMM d, h:mm a')}</time>
                  </div>
                  <p>{c.hidden_at ? <em>Message removed</em> : c.body}</p>
                </div>
                {!c.hidden_at && (owns || c.author_id === data.profile?.id) && (
                  <button
                    className="quiet"
                    aria-label="Remove message"
                    disabled={busy}
                    onClick={() => void act('hide_comment', { comment_id: c.id })}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
            {!comments.length && (
              <p className="muted">Start the conversation. Say hello to your fellow volunteers.</p>
            )}
          </div>
          {writable ? (
            <form
              className="message-form"
              onSubmit={async (e) => {
                e.preventDefault();
                if (await act('comment', { event_id: event.id, body })) setBody('');
              }}
            >
              <label className="sr-only" htmlFor="message">
                Your message
              </label>
              <textarea
                id="message"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Say hello, ask a question, or share an update…"
                maxLength={2000}
                required
              />
              <button className="button" disabled={busy || !body.trim()}>
                <Send size={16} /> Send
              </button>
            </form>
          ) : (
            <p className="inline-alert">This conversation is read-only.</p>
          )}
        </>
      )}
    </section>
  );
}
