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
import { useEffect, useState } from 'react';
import { useApp } from './provider';
import { AboutCarousel } from './about-carousel';
import { LandingPage } from './landing';
import { Empty, EventDetail, EventGrid, PageHeading } from './events';
import { AuthForm, EventForm, GroupForm, ManageEvent, ProfileForm } from './forms';
import { OnboardingForm } from './onboarding';
import { DeleteEventButton } from './event-delete';
import { CommunityNeeds } from './needs';
import { sameCity, shortLocation } from '@/lib/location';
import { authenticationState } from '@/lib/types';
import { isPublicPage } from '@/lib/access';
import { eventPhase, formatDate } from '@/lib/domain';

export function AppScreen({ route }: { route: string }) {
  const { ready, data } = useApp();
  const router = useRouter();
  const signedOut = authenticationState(data) === 'signed_out';
  useEffect(() => {
    if (ready && signedOut && !isPublicPage(route)) router.replace('/');
  }, [ready, signedOut, route, router]);
  if (!ready)
    return (
      <div className="loading-shell" role="status">
        <span className="eyebrow">SMALL ACTS FOR BIG CHANGE</span>
        <h1>A little good is on its way…</h1>
        <div className="skeleton" />
      </div>
    );
  if (signedOut) {
    if (route === '/sign-in' || route === '/sign-up')
      return <AuthForm mode={route === '/sign-up' ? 'sign-up' : 'sign-in'} />;
    return <LandingPage />;
  }
  if (data.onboarding || route === '/onboarding') return <OnboardingForm />;
  if (route === '/') return <About />;
  if (route === '/browse') return <Browse />;
  if (route === '/events') return <MyEvents />;
  if (route.startsWith('/events/')) return <EventDetail id={route.split('/')[2]} />;
  if (route === '/community') return <Community />;
  if (route === '/needs') return <CommunityNeeds />;
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
    useSavedCity = !params.has('city'),
    city = params.get('city') ?? (data.profile?.location ? shortLocation(data.profile) : ''),
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
        (useSavedCity
          ? sameCity(e.location, data.profile?.location)
          : !city || shortLocation(e).toLowerCase().includes(city.toLowerCase())) &&
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
        title="A cause for everyone."
        description="Browse opportunities in your area."
      />
      <p className="muted">
        {useSavedCity ? (
          data.profile?.location ? (
            <>
              Showing events in {shortLocation(data.profile)}. Change the location filter to search
              elsewhere.
            </>
          ) : (
            <>
              Confirm your city in{' '}
              <Link className="text-link" href="/profile">
                your profile
              </Link>{' '}
              to see local events, or enter a location below.
            </>
          )
        ) : city ? (
          <>Showing events matching {city}.</>
        ) : (
          'Showing all locations.'
        )}
      </p>
      <form
        key={`${params.toString()}:${data.profile?.id}:${data.profile?.location?.id}`}
        className="filter-panel"
        onSubmit={(e) => {
          e.preventDefault();
          const values = new FormData(e.currentTarget),
            next = new URLSearchParams();
          values.forEach((v, k) => {
            if (v || k === 'city') next.set(k, String(v));
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
          <input
            name="city"
            placeholder="City or state, e.g. Williamsburg, VA"
            defaultValue={city}
          />
        </label>
        <label>
          <span>Organizing group</span>
          <select name="group" defaultValue={group}>
            <option value="">All groups</option>
            {data.groups
              .filter((g) => !g.archived_at)
              .map((g) => (
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
                <div className="event-row-actions">
                  <Link className="button secondary small" href={`/event-hub/${e.id}/manage`}>
                    {tab === 'previous' ? 'Record attendance' : 'Manage'}
                    <ArrowRight size={15} />
                  </Link>
                  {eventPhase(e) === 'upcoming' && (
                    <Link
                      className="button secondary small"
                      href={`/event-hub/${e.id}/manage#edit-event`}
                    >
                      Edit event
                    </Link>
                  )}
                  <DeleteEventButton event={e} />
                </div>
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
  if (group?.archived_at)
    return (
      <>
        <PageHeading
          eyebrow="ARCHIVED"
          title={group.name}
          description="This organization is no longer active on Turnout."
        />
        <section className="panel">
          <h2>Archived organization</h2>
          <p className="muted">
            Upcoming and ongoing events were cancelled when this account was deleted. Past event
            records and verified volunteer hours are preserved in service history.
          </p>
        </section>
      </>
    );
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
          {shortLocation(group)}
          {group.website_url && (
            <a className="text-link" href={group.website_url} target="_blank" rel="noreferrer">
              Visit website <ArrowRight size={15} />
            </a>
          )}
          {group.public_contact_email && (
            <a className="text-link" href={`mailto:${group.public_contact_email}`}>
              Contact organization <ArrowRight size={15} />
            </a>
          )}
        </p>
        {!!group.causes?.length && <p className="muted">Focus areas: {group.causes.join(', ')}</p>}
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
        title="Browse organizations"
        description="Get to know the organizations showing up in your community."
      />
      <div className="group-grid">
        {data.groups
          .filter((g) => !g.archived_at)
          .map((g) => (
            <article className="panel group-card" key={g.id}>
              <span className="group-logo">
                <Users size={30} />
              </span>
              <p className="eyebrow">{shortLocation(g)}</p>
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
