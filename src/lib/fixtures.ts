import { DateTime } from 'luxon';
import type { DemoState, Event, Profile, Signup } from './types';
import { DEMO_LOCATIONS } from './location';
export const fixtureId = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export function makeFixtures(now = new Date()): DemoState {
  const day = DateTime.fromJSDate(now).setZone('America/New_York').startOf('day');
  const profiles: Profile[] = [
    {
      id: fixtureId(1),
      role: 'volunteer',
      display_name: 'Maya King',
      bio: 'Williamsburg neighbor, book lover, and believer in small acts of kindness.',
      city: 'Williamsburg',
      avatar_path: null,
    },
    {
      id: fixtureId(2),
      role: 'volunteer',
      display_name: 'Jordan Ellis',
      bio: 'Happy to lend a hand in my community.',
      city: 'Williamsburg',
      avatar_path: null,
    },
    {
      id: fixtureId(3),
      role: 'volunteer',
      display_name: 'Alex Chen',
      bio: 'Looking for my next opportunity to give back.',
      city: 'Williamsburg',
      avatar_path: null,
    },
    {
      id: fixtureId(4),
      role: 'organization',
      display_name: 'Mercy Coordinator',
      bio: 'Demo organization coordinator.',
      city: 'Williamsburg',
      avatar_path: null,
    },
    {
      id: fixtureId(5),
      role: 'organization',
      display_name: 'Library Coordinator',
      bio: 'Demo organization coordinator.',
      city: 'Williamsburg',
      avatar_path: null,
    },
  ];
  profiles.forEach((profile) =>
    Object.assign(profile, {
      location: structuredClone(DEMO_LOCATIONS[0]),
      interests: [],
      skills: '',
    }),
  );
  const groups = [
    {
      id: fixtureId(10),
      owner_id: fixtureId(4),
      name: 'Williamsburg House of Mercy',
      location: structuredClone(DEMO_LOCATIONS[0]),
      slug: 'williamsburg-house-of-mercy',
      description:
        'Demo community opportunities supporting food access and neighbors helping neighbors in Williamsburg.',
      city: 'Williamsburg',
      website_url: null,
    },
    {
      id: fixtureId(11),
      owner_id: fixtureId(5),
      name: 'Williamsburg Regional Library',
      location: structuredClone(DEMO_LOCATIONS[0]),
      slug: 'williamsburg-regional-library',
      description:
        'Demo opportunities to connect our community through books, learning, and a shared love of reading.',
      city: 'Williamsburg',
      website_url: null,
    },
  ];
  const specs = [
    {
      n: 20,
      g: 10,
      offset: 3,
      hour: 9,
      title: 'Pantry Packing',
      venue: 'Demo pantry packing room',
      text: 'Help sort donated food and pack grocery bags for local neighbors. Meet the coordinator at the demo pantry entrance; a short orientation is included.',
      tasks: ['Sort donations', 'Pack grocery bags'],
      caps: [6, 6],
      bring: ['Closed-toe shoes', 'Water bottle'],
      series: true,
    },
    {
      n: 21,
      g: 11,
      offset: 5,
      hour: 10,
      title: 'Book Donation Sorting',
      venue: 'Demo library sorting room',
      text: 'Give donated books their next chapter. Sort books by category and prepare welcoming donation tables. Meet in the demo sorting room for orientation.',
      tasks: ['Sort books', 'Arrange donation tables'],
      caps: [6, 4],
      bring: ['Comfortable shoes', 'Water bottle'],
      series: false,
    },
    {
      n: 22,
      g: 11,
      offset: 7,
      hour: 13,
      title: 'Community Reading Kit Assembly',
      venue: 'Demo library meeting room',
      text: 'Put together reading kits that invite families to discover a new story. Assemble books and activities, then add labels. All craft supplies are provided.',
      tasks: ['Assemble kits', 'Prepare labels'],
      caps: [8, 2],
      bring: ['Reading glasses if needed'],
      series: false,
    },
    {
      n: 23,
      g: 10,
      offset: 4,
      hour: 15,
      title: 'Community Meal Preparation',
      venue: 'Demo community kitchen',
      text: 'Spend an afternoon preparing ingredients and setting tables for a community meal. Meet at the demo kitchen entrance for food handling instructions.',
      tasks: ['Food preparation', 'Dining setup'],
      caps: [4, 4],
      bring: ['Closed-toe shoes', 'Hair tie'],
      series: false,
    },
    {
      n: 24,
      g: 10,
      offset: 10,
      hour: 9,
      title: 'Pantry Packing',
      venue: 'Demo pantry packing room',
      text: 'Join the next weekly pantry session to sort donations and pack grocery bags for neighbors. Meet the coordinator at the demo pantry entrance.',
      tasks: ['Sort donations', 'Pack grocery bags'],
      caps: [6, 6],
      bring: ['Closed-toe shoes', 'Water bottle'],
      series: true,
    },
    {
      n: 25,
      g: 10,
      offset: -7,
      hour: 9,
      title: 'Neighbors Helping Neighbors',
      venue: 'Demo pantry packing room',
      text: 'A completed demo pantry session, with organizer-verified service hours.',
      tasks: ['Pack grocery bags'],
      caps: [12],
      bring: ['Water bottle'],
      series: false,
    },
  ];
  const events: Event[] = specs.map((s) => ({
    id: fixtureId(s.n),
    group_id: fixtureId(s.g),
    series_id: s.series ? fixtureId(30) : null,
    occurrence_index: s.series ? (s.n === 20 ? 0 : 1) : null,
    title: s.title,
    description: s.text,
    venue: s.venue,
    address: 'Demo venue — Williamsburg, VA',
    city: 'Williamsburg',
    location: structuredClone(DEMO_LOCATIONS[0]),
    starts_at: day.plus({ days: s.offset, hours: s.hour }).toUTC().toISO()!,
    ends_at: day
      .plus({ days: s.offset, hours: s.hour + 2 })
      .toUTC()
      .toISO()!,
    timezone: 'America/New_York',
    resources_to_bring: s.bring,
    status: 'published',
  }));
  const tasks = specs.flatMap((s) =>
    s.tasks.map((name, i) => ({
      id: fixtureId(s.n * 10 + i),
      event_id: fixtureId(s.n),
      name,
      description: 'Orientation and supplies provided by the coordinator.',
      capacity: s.caps[i],
      reserved: 0,
    })),
  );
  const signups: Signup[] = [
    {
      id: fixtureId(40),
      event_id: fixtureId(20),
      task_id: fixtureId(200),
      volunteer_id: fixtureId(1),
      status: 'active',
      verified_minutes: null,
      verified_by: null,
      verified_at: null,
      display_name: 'Maya King',
    },
    {
      id: fixtureId(41),
      event_id: fixtureId(25),
      task_id: fixtureId(250),
      volunteer_id: fixtureId(1),
      status: 'active',
      verified_minutes: 120,
      verified_by: fixtureId(4),
      verified_at: day.minus({ days: 6 }).toISO(),
      display_name: 'Maya King',
    },
    {
      id: fixtureId(42),
      event_id: fixtureId(25),
      task_id: fixtureId(250),
      volunteer_id: fixtureId(2),
      status: 'active',
      verified_minutes: 90,
      verified_by: fixtureId(4),
      verified_at: day.minus({ days: 6 }).toISO(),
      display_name: 'Jordan Ellis',
    },
  ];
  tasks.forEach(
    (t) => (t.reserved = signups.filter((s) => s.task_id === t.id && s.status === 'active').length),
  );
  return {
    profile: profiles[0],
    profiles,
    groups,
    events,
    tasks,
    signups,
    series: [
      {
        id: fixtureId(30),
        group_id: fixtureId(10),
        frequency: 'weekly',
        interval_weeks: 1,
        occurrence_count: 2,
        timezone: 'America/New_York',
        first_local_start: day.plus({ days: 3, hours: 9 }).toFormat("yyyy-MM-dd'T'HH:mm"),
        duration_minutes: 120,
      },
    ],
    comments: [
      {
        id: fixtureId(50),
        event_id: fixtureId(20),
        author_id: fixtureId(4),
        display_name: 'Mercy Coordinator',
        body: 'Welcome, neighbors! We’ll meet at the pantry entrance. Supplies and a quick orientation are provided. Thank you for showing up.',
        created_at: day.toISO()!,
        hidden_at: null,
      },
    ],
  };
}
