'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowRight,
  MapPin,
  MessageSquare,
  Plus,
  Search,
  SlidersHorizontal,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import { useApp } from './provider';
import { AboutCarousel } from './about-carousel';
import { Empty, EventDetail, EventGrid, PageHeading } from './events';
import { AuthForm, EventForm, GroupForm, ManageEvent, ProfileForm, OnboardingForm } from './forms';
import { eventPhase, formatDate } from '@/lib/domain';

export function AppScreen({ route }: { route: string }) {
  const { ready, data } = useApp();
  if (!ready)
    return (
      <div className="loading-shell" role="status">
        <span className="eyebrow">DO GOOD, TOGETHER</span>
        <h1>A little good is on its way…</h1>
        <div className="skeleton" />
      </div>
    );
  if (data.onboarding || route === '/onboarding') return <OnboardingForm />;
  if (route === '/') return <About />;
  if (route === '/browse') return <Browse />;
  if (route === '/events') return <MyEvents />;
  if (route.startsWith('/events/')) return <EventDetail id={route.split('/')[2]} />;
  if (route === '/community') return <Community />;
  if (route.startsWith('/groups/')) return <Community slug={route.split('/')[2]} />;
  if (route === '/messages') return <Messages />;
  if (route === '/profile') return <ProfileForm />;
  if (route === '/my-group') return <GroupForm />;
  if (route === '/event-hub') return <EventHub />;
  if (route === '/event-hub/new') return <EventForm />;
  if (route.startsWith('/event-hub/')) return <ManageEvent id={route.split('/')[2]} />;
  return <AuthForm mode={route === '/sign-up' ? 'sign-up' : 'sign-in'} />;
}
function About() {
  return (
    <>
      <h1 className="sr-only">About Turnout</h1>
      <AboutCarousel />
      <section className="community-strip">
        <span className="sparkle-box">
          <Users />
        </span>
        <div>
          <h2>Community service in your area</h2>
          <p>Meet the organizations making a difference in your neighborhood.</p>
        </div>
        <Link className="text-link" href="/community">
          Meet your community <ArrowRight size={17} />
        </Link>
      </section>
    </>
  );
}
function Browse() {
  const { data } = useApp(),
    params = useSearchParams(),
    router = useRouter();
  const q = params.get('q') ?? '',
    city = params.get('city') ?? '',
    group = params.get('group') ?? '',
    task = params.get('task') ?? '',
    page = Math.max(1, Number(params.get('page')) || 1);
  const matches = data.events
    .filter(
      (e) =>
        eventPhase(e) === 'upcoming' &&
        (!q ||
          `${e.title} ${e.description} ${e.city} ${data.groups.find((g) => g.id === e.group_id)?.name}`
            .toLowerCase()
            .includes(q.toLowerCase())) &&
        (!city || e.city.toLowerCase().includes(city.toLowerCase())) &&
        (!group || e.group_id === group) &&
        (!task ||
          data.tasks.some(
            (t) => t.event_id === e.id && t.name.toLowerCase().includes(task.toLowerCase()),
          )),
    )
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at) || a.id.localeCompare(b.id));
  return (
    <>
      <PageHeading
        eyebrow="FIND YOUR WAY TO GIVE BACK"
        title="A cause for every kind of you."
        description="A few hours. A meaningful connection. A stronger community."
      />
      <form
        key={params.toString()}
        className="filter-panel"
        onSubmit={(e) => {
          e.preventDefault();
          const values = new FormData(e.currentTarget),
            next = new URLSearchParams();
          values.forEach((v, k) => {
            if (v) next.set(k, String(v));
          });
          router.push(`/browse?${next}`);
        }}
      >
        <label className="search-field">
          <Search size={18} />
          <input
            name="q"
            aria-label="Search opportunities"
            placeholder="Search opportunities"
            defaultValue={q}
          />
        </label>
        <label>
          <span>Location</span>
          <input name="city" placeholder="Any city" defaultValue={city} />
        </label>
        <label>
          <span>Organizing group</span>
          <select name="group" defaultValue={group}>
            <option value="">All groups</option>
            {data.groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Task</span>
          <input name="task" placeholder="e.g. sort books" defaultValue={task} />
        </label>
        <button className="button">
          <SlidersHorizontal size={16} /> Filter
        </button>
      </form>
      <div className="result-heading">
        <p>
          <strong>{matches.length}</strong> upcoming{' '}
          {matches.length === 1 ? 'opportunity' : 'opportunities'}
        </p>
        {params.size > 0 && (
          <Link className="text-link" href="/browse">
            Clear filters
          </Link>
        )}
        <span className="muted">Soonest first</span>
      </div>
      {matches.length ? (
        <EventGrid events={matches.slice((page - 1) * 20, page * 20)} />
      ) : (
        <Empty title="No opportunities found">
          <p>Try a different city, group, or task.</p>
          <Link className="button secondary" href="/browse">
            Clear filters
          </Link>
        </Empty>
      )}
      {matches.length > 20 && (
        <div className="pagination">
          {Array.from({ length: Math.ceil(matches.length / 20) }, (_, i) => (
            <button
              className={`button ${page === i + 1 ? '' : 'secondary'}`}
              key={i}
              onClick={() => {
                const next = new URLSearchParams(params);
                next.set('page', String(i + 1));
                router.push(`/browse?${next}`);
              }}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
export function AuthRequired({
  organization = false,
  children,
}: {
  organization?: boolean;
  children: React.ReactNode;
}) {
  const { data } = useApp();
  if (!data.profile)
    return (
      <Empty title="Your community is waiting">
        <p>Sign in to manage your profile and opportunities.</p>
        <Link className="button" href="/sign-in">
          Sign in <ArrowRight size={16} />
        </Link>
      </Empty>
    );
  if (organization && data.profile.role !== 'organization')
    return (
      <Empty title="A space for organizers">
        <p>Create an organization account to manage a group and publish events.</p>
        <Link className="button secondary" href="/browse">
          Discover opportunities
        </Link>
      </Empty>
    );
  return <>{children}</>;
}
function MyEvents() {
  const { data } = useApp();
  const [tab, setTab] = useState('upcoming');
  const registered = new Set(
    data.signups
      .filter((s) => s.volunteer_id === data.profile?.id && s.status === 'active')
      .map((s) => s.event_id),
  );
  const events = data.events
    .filter(
      (e) =>
        registered.has(e.id) &&
        (tab === 'upcoming'
          ? ['upcoming', 'ongoing'].includes(eventPhase(e))
          : eventPhase(e) === tab),
    )
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  return (
    <AuthRequired>
      <PageHeading
        eyebrow="YOUR TIME MAKES A DIFFERENCE"
        title="My events"
        description="Everything you’ve signed up for, all in one place."
        action={
          <Link className="button" href="/browse">
            <Plus size={17} /> Find an event
          </Link>
        }
      />
      <Tabs value={tab} onChange={setTab} />
      {events.length ? (
        <EventGrid events={events} />
      ) : (
        <Empty title="Your next good thing is out there">
          <p>
            {tab === 'upcoming'
              ? 'You haven’t reserved any upcoming events yet.'
              : 'No events in this category yet.'}
          </p>
          <Link className="button secondary" href="/browse">
            Explore opportunities
          </Link>
        </Empty>
      )}
    </AuthRequired>
  );
}
export function Tabs({ value, onChange }: { value: string; onChange: (s: string) => void }) {
  return (
    <div className="tabs" role="tablist" aria-label="Event status">
      {['upcoming', 'previous', 'cancelled'].map((t) => (
        <button
          role="tab"
          aria-selected={value === t}
          className={value === t ? 'selected' : ''}
          key={t}
          onClick={() => onChange(t)}
        >
          {t === 'upcoming'
            ? 'Upcoming & ongoing'
            : t === 'previous'
              ? 'Previous events'
              : 'Cancelled'}
        </button>
      ))}
    </div>
  );
}
function EventHub() {
  const { data } = useApp();
  const [tab, setTab] = useState('upcoming');
  const group = data.groups.find((g) => g.owner_id === data.profile?.id);
  const events = data.events
    .filter(
      (e) =>
        e.group_id === group?.id &&
        (tab === 'upcoming'
          ? ['upcoming', 'ongoing'].includes(eventPhase(e))
          : eventPhase(e) === tab),
    )
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  return (
    <AuthRequired organization>
      <PageHeading
        eyebrow="YOUR ORGANIZATION, IN ACTION"
        title="Event hub"
        description={group?.name ?? 'Start by creating your group.'}
        action={
          <Link className="button" href={group ? '/event-hub/new' : '/my-group'}>
            <Plus size={18} />
            {group ? 'Create event' : 'Create your group'}
          </Link>
        }
      />
      <Tabs value={tab} onChange={setTab} />
      {events.length ? (
        <div className="panel event-table">
          {events.map((e) => {
            const signups = data.signups.filter(
              (s) => s.event_id === e.id && s.status === 'active',
            );
            return (
              <div className="event-table-row" key={e.id}>
                <span className="table-date">
                  <small>{formatDate(e.starts_at, e.timezone, 'MMM')}</small>
                  <strong>{formatDate(e.starts_at, e.timezone, 'd')}</strong>
                </span>
                <div>
                  <Link href={`/events/${e.id}`}>
                    <h3>{e.title}</h3>
                  </Link>
                  <p>
                    {formatDate(e.starts_at, e.timezone, 'h:mm a')} · {e.venue}
                  </p>
                </div>
                <span className="attendee-count">
                  <Users size={16} />
                  {signups.length} registered
                </span>
                <Link className="button secondary small" href={`/event-hub/${e.id}/manage`}>
                  {tab === 'previous' ? 'Record attendance' : 'Manage'}
                  <ArrowRight size={15} />
                </Link>
              </div>
            );
          })}
        </div>
      ) : (
        <Empty title={group ? 'Make room for something good' : 'Give your organization a home'}>
          <p>
            {group
              ? 'Create an opportunity and invite your community to join.'
              : 'Add your group details before publishing your first event.'}
          </p>
          <Link className="button" href={group ? '/event-hub/new' : '/my-group'}>
            {group ? 'Create event' : 'Create group'}
          </Link>
        </Empty>
      )}
    </AuthRequired>
  );
}
function Community({ slug }: { slug?: string }) {
  const { data } = useApp();
  const group = slug ? data.groups.find((g) => g.slug === slug) : null;
  if (slug && !group) return <Empty title="Group not found" />;
  if (group)
    return (
      <>
        <PageHeading
          eyebrow="GOOD PEOPLE. SHARED PURPOSE."
          title={group.name}
          description={group.description}
        />
        <p className="location-line">
          <MapPin size={17} />
          {group.city}
          {group.website_url && (
            <a className="text-link" href={group.website_url} target="_blank" rel="noreferrer">
              Visit website <ArrowRight size={15} />
            </a>
          )}
        </p>
        <h2 className="section-title">Upcoming opportunities</h2>
        <EventGrid
          events={data.events.filter(
            (e) => e.group_id === group.id && eventPhase(e) === 'upcoming',
          )}
        />
        {!data.events.some((e) => e.group_id === group.id && eventPhase(e) === 'upcoming') && (
          <Empty title="New opportunities are on the way" />
        )}
      </>
    );
  return (
    <>
      <PageHeading
        eyebrow="ROOTED IN YOUR NEIGHBORHOOD"
        title="Good happens together."
        description="Get to know the organizations showing up for our community."
      />
      <div className="group-grid">
        {data.groups.map((g) => (
          <article className="panel group-card" key={g.id}>
            <span className="group-logo">
              <Users size={30} />
            </span>
            <p className="eyebrow">{g.city}</p>
            <h2>{g.name}</h2>
            <p>{g.description}</p>
            <Link href={`/groups/${g.slug}`} className="text-link">
              Meet the group <ArrowRight size={17} />
            </Link>
          </article>
        ))}
      </div>
    </>
  );
}
function Messages() {
  const { data } = useApp();
  const ids = new Set(
    data.signups
      .filter((s) => s.volunteer_id === data.profile?.id && s.status === 'active')
      .map((s) => s.event_id),
  );
  const events = data.events.filter(
    (e) =>
      ids.has(e.id) ||
      data.groups.some((g) => g.id === e.group_id && g.owner_id === data.profile?.id),
  );
  return (
    <AuthRequired>
      <PageHeading
        eyebrow="STAY CONNECTED"
        title="Your conversations"
        description="Questions, meeting points, and friendly hellos. Every event has its own conversation."
      />
      {events.length ? (
        <div className="panel conversation-list">
          {events.map((e) => {
            const comments = data.comments
              .filter((c) => c.event_id === e.id && !c.hidden_at)
              .sort((a, b) => b.created_at.localeCompare(a.created_at));
            return (
              <Link className="conversation-row" href={`/events/${e.id}`} key={e.id}>
                <span className="sparkle-box">
                  <MessageSquare size={22} />
                </span>
                <div>
                  <h3>{e.title}</h3>
                  <p>
                    {comments[0]
                      ? `${comments[0].display_name}: ${comments[0].body}`
                      : 'Start the conversation with your group.'}
                  </p>
                  <small>
                    {formatDate(e.starts_at)} · {e.venue}
                  </small>
                </div>
                <ArrowRight size={20} />
              </Link>
            );
          })}
        </div>
      ) : (
        <Empty title="Your conversations start here">
          <p>Join an event to connect with its volunteers and organizer.</p>
          <Link className="button" href="/browse">
            Find an event
          </Link>
        </Empty>
      )}
    </AuthRequired>
  );
}
