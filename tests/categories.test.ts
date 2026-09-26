import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { CAUSES, DEMO_LOCATIONS, interestsSchema } from '../src/lib/location';
import { demoCommand } from '../src/lib/demo';
import { makeFixtures } from '../src/lib/fixtures';
import type { Snapshot } from '../src/lib/types';

const additions = ['Gift-making', 'Clothing', 'Letter writing', 'Religious', 'Campaign'];
const localStart = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 16);
const input = {
  title: 'Community Service Session',
  description: 'Help with a community service activity.',
  venue: 'Community room',
  address: 'Main entrance',
  location: DEMO_LOCATIONS[0],
  timezone: 'UTC',
  localStart,
  duration: 60,
  interval: 1,
  count: 2,
  resources_to_bring: [],
  tasks: [{ name: 'Prepare supplies', capacity: 8 }],
};

test('shared categories add the approved labels and demo recurring events retain them', () => {
  assert.deepEqual(interestsSchema.parse(additions), additions);
  assert.equal(CAUSES.filter((name) => name === 'Education').length, 1);
  assert.equal(interestsSchema.safeParse(['Clean-up']).success, false);
  assert.equal(interestsSchema.safeParse(['Unknown category']).success, false);
  const demo = makeFixtures();
  demo.profile = demo.profiles[3];
  const saved = demoCommand(demo, 'create_event', {
    ...input,
    location_id: DEMO_LOCATIONS[0].id,
    resources: '',
    categories: additions,
  });
  const events = saved.events.filter((event) => event.title === input.title);
  assert.equal(events.length, 2);
  assert.ok(
    events.every((event) => JSON.stringify(event.categories) === JSON.stringify(additions)),
  );
});

test('category migration preserves old data and enforces event authorization and atomic persistence', async () => {
  const db = new PGlite();
  const migrate = async (file: string) =>
    db.exec(await readFile(new URL(`../database/migrations/${file}`, import.meta.url), 'utf8'));
  const command = (kind: string, payload: unknown) =>
    db.query<{ result: { id: string } }>('select public.app_command($1,$2) as result', [
      kind,
      JSON.stringify(payload),
    ]);
  const snapshot = async () =>
    (await db.query<{ data: Snapshot }>('select public.app_snapshot() as data')).rows[0].data;
  const as = async (id: string | null) => {
    await db.exec('reset role');
    await db.query("select set_config('app.user_id',$1,false)", [id ?? '']);
    await db.exec('set role commonly_runtime');
  };
  try {
    await migrate('001_foundation.sql');
    await migrate('002_onboarding_locations.sql');
    const owner = (
      await db.query<{ id: string }>(
        "select public.app_resolve_user('auth0|category-owner','Category Owner') as id",
      )
    ).rows[0].id;
    await as(owner);
    await command('onboard', {
      role: 'organization',
      display_name: 'Category Owner',
      location: DEMO_LOCATIONS[0],
      organization_name: 'Community Helpers',
      organization_description: 'Community service organization.',
      interests: ['Education'],
    });
    await command('create_event', input);
    const before = await snapshot();
    await db.exec('reset role');
    await migrate('003_event_categories.sql');
    await as(owner);
    let current = await snapshot();
    assert.deepEqual(current.profile?.interests, ['Education']);
    assert.deepEqual(current.groups[0].causes, ['Education']);
    assert.deepEqual(
      current.events.map((e) => e.id),
      before.events.map((e) => e.id),
    );
    assert.ok(current.events.every((event) => event.categories?.length === 0));
    await command('profile', {
      display_name: 'Category Owner',
      bio: '',
      location: DEMO_LOCATIONS[0],
      interests: additions,
    });
    await command('group', {
      name: 'Community Helpers',
      description: 'Community service organization.',
      location: DEMO_LOCATIONS[0],
      website_url: '',
      causes: additions,
    });
    current = await snapshot();
    assert.deepEqual(current.profile?.interests, additions);
    assert.deepEqual(current.groups[0].causes, additions);
    const created = (
      await command('create_event', { ...input, title: 'Labeled series', categories: additions })
    ).rows[0].result.id;
    current = await snapshot();
    const series = current.events.filter((event) => event.title === 'Labeled series');
    assert.equal(series.length, 2);
    assert.ok(
      series.every((event) => JSON.stringify(event.categories) === JSON.stringify(additions)),
    );
    const occurrence = current.events.find((event) => event.id === created)!;
    const edit = {
      ...input,
      event_id: created,
      starts_at: occurrence.starts_at,
      tasks: current.tasks.filter((task) => task.event_id === created),
    };
    await command('update_event', { ...edit, categories: ['Environment', 'Community support'] });
    assert.deepEqual((await snapshot()).events.find((e) => e.id === created)?.categories, [
      'Environment',
      'Community support',
    ]);
    assert.deepEqual(
      (await snapshot()).events.find(
        (e) => e.series_id === occurrence.series_id && e.id !== created,
      )?.categories,
      additions,
    );
    // Older callers omit categories; they must not erase existing selections.
    await command('update_event', edit);
    assert.deepEqual((await snapshot()).events.find((e) => e.id === created)?.categories, [
      'Environment',
      'Community support',
    ]);
    await assert.rejects(
      command('update_event', { ...edit, title: 'Must roll back', categories: ['Clean-up'] }),
      /check constraint/,
    );
    assert.equal((await snapshot()).events.find((e) => e.id === created)?.title, edit.title);
    const count = (await snapshot()).events.length;
    await assert.rejects(
      command('create_event', { ...input, categories: ['Not a category'] }),
      /check constraint/,
    );
    await assert.rejects(
      command('create_event', { ...input, categories: 'Campaign' }),
      /valid event categories/,
    );
    assert.equal((await snapshot()).events.length, count);
    await assert.rejects(
      db.query("select private.app_command_v2('update_event',$1)", [JSON.stringify(edit)]),
      /permission denied/,
    );
    await command('update_event', { ...edit, categories: [] });
    assert.deepEqual((await snapshot()).events.find((e) => e.id === created)?.categories, []);
    await as(null);
    await assert.rejects(command('update_event', { ...edit, categories: ['Campaign'] }), /Sign in/);
    const other = (
      await db.query<{ id: string }>(
        "select public.app_resolve_user('auth0|other-category-owner','Other Owner') as id",
      )
    ).rows[0].id;
    await as(other);
    await command('onboard', {
      role: 'organization',
      display_name: 'Other Owner',
      location: DEMO_LOCATIONS[0],
      organization_name: 'Other Helpers',
      organization_description: 'Another service organization.',
      interests: ['Community support'],
    });
    await assert.rejects(command('update_event', { ...edit, categories: ['Campaign'] }));
    assert.deepEqual((await snapshot()).events.find((e) => e.id === created)?.categories, []);
  } finally {
    await db.close();
  }
});
