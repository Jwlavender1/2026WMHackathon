import { createClient } from '@supabase/supabase-js';
import { makeFixtures } from '../src/lib/fixtures';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.SEED_PASSWORD;
if (!url || !key || !password || password.length < 12)
  throw new Error(
    'Set the Supabase URL, server-only service role key, and a SEED_PASSWORD of at least 12 characters in .env.local.',
  );
const hostname = new URL(url).hostname;
const local = ['localhost', '127.0.0.1', '::1'].includes(hostname);
if (
  process.env.ALLOW_DEMO_SEED !== 'true' ||
  (!local && hostname !== `${process.env.SEED_PROJECT_REF}.supabase.co`)
)
  throw new Error(
    'Seed only a designated demo project: set ALLOW_DEMO_SEED=true and SEED_PROJECT_REF to its project reference (not needed for localhost).',
  );
const client = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
const fixtures = makeFixtures();
const ids = new Map<string, string>();
const emails = ['maya', 'jordan', 'alex', 'mercy', 'library'];
const existingUsers = [];
for (let page = 1; ; page++) {
  const { data, error } = await client.auth.admin.listUsers({ page, perPage: 100 });
  if (error) throw error;
  existingUsers.push(...data.users);
  if (data.users.length < 100) break;
}
for (const [i, profile] of fixtures.profiles.entries()) {
  const email = `${emails[i]}@commonly.example`;
  let user = existingUsers.find((u) => u.email === email);
  if (!user) {
    const { data, error } = await client.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: profile.display_name, role: profile.role },
    });
    if (error) throw error;
    user = data.user;
    const { error: profileError } = await client
      .from('profiles')
      .update({ bio: profile.bio, city: profile.city })
      .eq('user_id', user.id);
    if (profileError) throw profileError;
  }
  ids.set(profile.id, user.id);
}
const mapId = (id: string | null) => (id ? (ids.get(id) ?? id) : null);
async function insert(table: string, rows: unknown[]) {
  const { error } = await client
    .from(table)
    .upsert(rows, { onConflict: 'id', ignoreDuplicates: true });
  if (error) throw new Error(`${table}: ${error.message}`);
}
await insert(
  'groups',
  fixtures.groups.map((g) => ({ ...g, owner_id: mapId(g.owner_id!) })),
);
await insert('event_series', fixtures.series);
await insert('events', fixtures.events);
await insert(
  'event_tasks',
  fixtures.tasks.map(({ reserved: _, ...task }) => task),
);
await insert(
  'signups',
  fixtures.signups.map(({ display_name: _, ...s }) => ({
    ...s,
    volunteer_id: mapId(s.volunteer_id),
    verified_by: mapId(s.verified_by),
  })),
);
await insert(
  'event_comments',
  fixtures.comments.map(({ display_name: _, ...c }) => ({ ...c, author_id: mapId(c.author_id) })),
);
console.log(
  'Seed complete: 2 groups, 5 upcoming occurrences, 1 past event, 5 demo accounts. Existing fixture records were preserved.',
);
console.log('Demo account emails:', emails.map((n) => `${n}@commonly.example`).join(', '));
console.log(
  'Use the SEED_PASSWORD you supplied. No real organization accounts or events were created.',
);
