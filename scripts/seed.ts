import { Client } from 'pg';
import { makeFixtures } from '../src/lib/fixtures';
import { connectionOptions } from '../src/lib/db/connection';

async function main() {
  const url = process.env.MIGRATION_DATABASE_URL;
  if (!url) throw new Error('Set MIGRATION_DATABASE_URL for the designated demo database.');
  const hostname = new URL(url).hostname;
  if (process.env.ALLOW_DEMO_SEED !== 'true' || process.env.SEED_DATABASE_HOST !== hostname)
    throw new Error(
      'Set ALLOW_DEMO_SEED=true and SEED_DATABASE_HOST to the exact target hostname.',
    );
  const client = new Client(connectionOptions(url));
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtext('commonly:seed'))");
    const fixtures = makeFixtures(),
      ids = new Map<string, string>();
    async function insert(table: string, rows: Record<string, unknown>[]) {
      for (const row of rows) {
        const keys = Object.keys(row);
        await client.query(
          'INSERT INTO public.' +
            table +
            ' (' +
            keys.join(',') +
            ') VALUES (' +
            keys.map((_, i) => '$' + (i + 1)).join(',') +
            ') ON CONFLICT DO NOTHING',
          Object.values(row),
        );
      }
    }
    for (const [i, p] of fixtures.profiles.entries()) {
      const sub =
        i === 3
          ? process.env.SEED_MERCY_AUTH0_SUB
          : i === 4
            ? process.env.SEED_LIBRARY_AUTH0_SUB
            : undefined;
      const subject = sub || 'demo:' + p.id;
      const found = await client.query<{ id: string; role: string | null }>(
        'SELECT id,role FROM public.users WHERE auth0_sub=$1',
        [subject],
      );
      const user = found.rows[0];
      if (user && user.role !== p.role)
        throw new Error(
          'A mapped seed owner must already have the organization role. Complete onboarding first.',
        );
      const id = user?.id ?? p.id;
      if (sub && user) {
        const owned = await client.query<{ id: string }>(
          'SELECT id FROM public.groups WHERE owner_id=$1',
          [id],
        );
        if (owned.rows.some((group) => group.id !== fixtures.groups[i - 3].id))
          throw new Error(
            'A mapped seed owner already manages a different group. Use an unused Auth0 account or leave the sample group unmapped; seeding will not replace their group.',
          );
      }
      ids.set(p.id, id);
      if (!user) {
        // Do not silently change an existing fixture identity when mapping configuration changes.
        const conflict = await client.query('SELECT id FROM public.users WHERE id=$1', [id]);
        if (conflict.rowCount)
          throw new Error(
            'Fixture user already has another identity. Use a fresh demo database or migrate that mapping explicitly.',
          );
        await insert('users', [{ id, auth0_sub: subject, role: p.role }]);
      }
      await insert('profiles', [
        {
          user_id: id,
          display_name: p.display_name,
          bio: p.bio,
          city: p.city,
          location: p.location,
          interests: p.interests,
          skills: p.skills,
          avatar_path: null,
        },
      ]);
    }
    const map = (id: string | null | undefined) => (id ? (ids.get(id) ?? id) : null);
    await insert(
      'groups',
      fixtures.groups.map((g) => ({ ...g, owner_id: map(g.owner_id) })),
    );
    await insert('event_series', fixtures.series);
    await insert('events', fixtures.events);
    await insert(
      'event_tasks',
      fixtures.tasks.map(({ reserved: _, ...t }) => t),
    );
    await insert(
      'signups',
      fixtures.signups.map(({ display_name: _, ...s }) => ({
        ...s,
        volunteer_id: map(s.volunteer_id),
        verified_by: map(s.verified_by),
      })),
    );
    await insert(
      'event_comments',
      fixtures.comments.map(({ display_name: _, ...c }) => ({ ...c, author_id: map(c.author_id) })),
    );
    await client.query('COMMIT');
    console.log(
      'Seed complete: 2 demo groups, 5 future occurrences, 1 past event, reservations, attendance, and a conversation.',
    );
    console.log('No Auth0 users or passwords were created. Existing fixtures were preserved.');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Seeding failed.');
  process.exitCode = 1;
});
