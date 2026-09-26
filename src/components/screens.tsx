'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowRight,
  Heart,
  MapPin,
  MessageSquare,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkle,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import { useApp } from './provider';
import { Empty, EventDetail, EventGrid, PageHeading, photos } from './events';
import { AuthForm, EventForm, GroupForm, ManageEvent, ProfileForm, OnboardingForm } from './forms';
import { eventPhase, formatDate, hoursServed } from '@/lib/domain';

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
  if (route === '/') return <Home />;
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
function Home() {
  const { data } = useApp(),
    profile = data.profile,
    org = profile?.role === 'organization';
  const upcoming = data.events
    .filter((e) => eventPhase(e) === 'upcoming')
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const mine = data.signups.filter((s) => s.volunteer_id === profile?.id && s.status === 'active');
  const completed = mine.filter((s) => s.verified_minutes !== null && s.verified_minutes > 0);
  const total = profile ? hoursServed(data.signups, profile.id) : 0;
  const groups = new Set(
    completed.map((s) => data.events.find((e) => e.id === s.event_id)?.group_id),
  ).size;
  const next = upcoming.find((e) => mine.some((s) => s.event_id === e.id));
  const ownedEventIds = new Set(
    data.events
      .filter((e) => data.groups.some((g) => g.id === e.group_id && g.owner_id === profile?.id))
      .map((e) => e.id),
  );
  const organizationSignups = data.signups.filter((s) => ownedEventIds.has(s.event_id));
  return (
    <>
      <div className="home-top">
        <section
          className="hero"
          style={{
            backgroundImage: `linear-gradient(90deg,rgba(7,12,29,.96),rgba(7,12,29,.65)),url("${photos.food}")`,
          }}
        >
          <span className="welcome">
            <span className="live-dot" />
            {profile
              ? `Welcome back, ${profile.display_name.split(' ')[0]}`
              : 'A little good starts with you'}
          </span>
          <h1>
            Small acts.
            <br />
            Real change.
          </h1>
          <p>
            Find your next way to help, connect with neighbors, and keep every event detail in one
            place.
          </p>
          <Link className="button white hero-button" href="/browse">
            Explore opportunities <ArrowRight size={20} />
          </Link>
        </section>
        <section className="impact-card">
          <div className="impact-heading">
            <div>
              <p className="eyebrow">YOUR IMPACT</p>
              <h2>{org ? 'Good starts here' : 'Your good adds up'}</h2>
            </div>
            <span className="sparkle-box">
              <Sparkle size={22} />
            </span>
          </div>
          <div className="stats">
            {org ? (
              <>
                <Stat
                  value={
                    data.events.filter((e) =>
                      data.groups.some((g) => g.id === e.group_id && g.owner_id === profile.id),
                    ).length
                  }
                  label="Events"
                />
                <Stat
                  value={organizationSignups.filter((s) => s.status === 'active').length}
                  label="Sign-ups"
                />
                <Stat
                  value={
                    organizationSignups.reduce((n, s) => n + (s.verified_minutes ?? 0), 0) / 60
                  }
                  label="Hours given"
                />
              </>
            ) : (
              <>
                <Stat value={total} label="Hours" />
                <Stat value={completed.length} label="Events" />
                <Stat value={groups} label="Groups" />
              </>
            )}
          </div>
          <div className="next-good">
            <div>
              <strong>
                {next
                  ? 'Your next good thing'
                  : org
                    ? 'Bring people together'
                    : 'Your next chapter'}
              </strong>
              <Heart size={16} />
            </div>
            <p>
              {next
                ? next.title
                : org
                  ? 'A shared purpose starts with a simple invitation.'
                  : 'Find a cause you care about. We’ll help you show up.'}
            </p>
            <Link href={next ? `/events/${next.id}` : org ? '/event-hub/new' : '/browse'}>
              {next
                ? `${formatDate(next.starts_at)} · ${formatDate(next.starts_at, undefined, 'h:mm a')}`
                : org
                  ? 'Create an opportunity'
                  : 'Discover an opportunity'}{' '}
              <ArrowRight size={15} />
            </Link>
          </div>
        </section>
      </div>
      <section className="opportunities">
        <div className="section-heading">
          <div>
            <p className="eyebrow">NEAR YOU</p>
            <h2>Upcoming opportunities</h2>
          </div>
          <Link href="/browse" className="text-link">
            View all <ArrowRight size={17} />
          </Link>
        </div>
        {upcoming.length ? (
          <EventGrid events={upcoming.slice(0, 3)} />
        ) : (
          <Empty title="Good things are on the way">
            <p>Check back soon for new opportunities.</p>
          </Empty>
        )}
      </section>
      <section className="community-strip">
        <span className="sparkle-box">
          <Users />
        </span>
        <div>
          <h3>Good people. Shared purpose.</h3>
          <p>Meet the organizations making a difference in your neighborhood.</p>
        </div>
        <Link className="text-link" href="/community">
          Meet your community <ArrowRight size={17} />
        </Link>
      </section>
    </>
  );
}
function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <strong>{Number.isInteger(value) ? value : value.toFixed(1)}</strong>
      <span>{label}</span>
    </div>
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
