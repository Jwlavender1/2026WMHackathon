import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { parseCity, searchCities, signLocation, verifyLocation } from '../src/lib/geocoding';
import { DEMO_LOCATIONS } from '../src/lib/location';
import { authenticationState } from '../src/lib/types';
import { makeFixtures } from '../src/lib/fixtures';
import { demoCommand } from '../src/lib/demo';
import type { Snapshot } from '../src/lib/types';
import { onboardingSchema } from '../src/lib/domain';

const place = { ...DEMO_LOCATIONS[0], provider: 'geoapify' as const, id: 'provider-test-place' };
test('location proof rejects tampering, mismatched identities, IDs, expired and demo selections', () => {
  const proof = signLocation(place, 'auth0|a', 'test-secret', 1000);
  assert.deepEqual(verifyLocation(proof, place.id, 'auth0|a', 'test-secret', 2000), place);
  for (const [token, id, actor, time] of [
    [proof + 'x', place.id, 'auth0|a', 2000],
    [proof, 'other-city', 'auth0|a', 2000],
    [proof, place.id, 'auth0|b', 2000],
    [proof, place.id, 'auth0|a', 3601000],
    [
      signLocation(DEMO_LOCATIONS[0], 'auth0|a', 'test-secret', 1000),
      DEMO_LOCATIONS[0].id,
      'auth0|a',
      2000,
    ],
  ] as const)
    assert.throws(
      () => verifyLocation(token, id, actor, 'test-secret', time),
      /Select your city again/,
    );
});

test('migration supports the deployed city-only server without retaining stale locations', async () => {
  const db = new PGlite();
  try {
    for (const file of ['001_foundation.sql', '002_onboarding_locations.sql'])
      await db.exec(
        await readFile(new URL(`../database/migrations/${file}`, import.meta.url), 'utf8'),
      );
    const user = await db.query<{ id: string }>(
      "select public.app_resolve_user('auth0|legacy-rollout','Legacy Organizer') as id",
    );
    await db.query("select set_config('app.user_id',$1,false)", [user.rows[0].id]);
    await db.exec('set role commonly_runtime');
    const command = (kind: string, payload: unknown) =>
      db.query('select public.app_command($1,$2)', [kind, JSON.stringify(payload)]);
    const snapshot = async () =>
      (await db.query<{ data: Snapshot }>('select public.app_snapshot() as data')).rows[0].data;
    const legacyOnboarding = {
      role: 'organization',
      display_name: 'Legacy Organizer',
      city: 'Williamsburg',
    };
    // The deployed server remains usable; the new server schema still rejects unselected cities.
    assert.equal(onboardingSchema.safeParse(legacyOnboarding).success, false);
    await command('onboard', legacyOnboarding);
    assert.equal((await snapshot()).profile?.location, null);
    const group = {
      name: 'Legacy Group',
      description: 'Community service organization.',
      city: 'Williamsburg',
      website_url: '',
    };
    await command('group', group);
    assert.equal((await snapshot()).groups.length, 1);
    const profile = {
      display_name: 'Legacy Organizer',
      bio: 'Community volunteer.',
      city: 'Williamsburg',
    };
    await command('profile', {
      ...profile,
      location: place,
      skills: 'Sorting',
      interests: ['Education'],
    });
    await command('profile', profile);
    assert.equal((await snapshot()).profile?.location?.id, place.id);
    await command('profile', { ...profile, city: 'Richmond' });
    assert.equal((await snapshot()).profile?.location, null);
    assert.equal((await snapshot()).profile?.skills, 'Sorting');
    assert.deepEqual((await snapshot()).profile?.interests, ['Education']);
    await command('group', {
      ...group,
      location: place,
      causes: ['Education'],
      public_contact_email: 'contact@example.org',
    });
    await command('group', group);
    assert.equal((await snapshot()).groups[0].location?.id, place.id);
    await command('group', { ...group, city: 'Richmond' });
    assert.equal((await snapshot()).groups[0].location, null);
    assert.equal((await snapshot()).groups[0].public_contact_email, 'contact@example.org');
    assert.deepEqual((await snapshot()).groups[0].causes, ['Education']);
    const event = {
      title: 'Rollout Community Event',
      description: 'An event used to verify rollout compatibility.',
      venue: 'Community Hall',
      address: 'Main entrance',
      city: 'Williamsburg',
      timezone: 'UTC',
      localStart: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 16),
      duration: 60,
      interval: 1,
      count: 2,
      resources_to_bring: [],
      tasks: [{ name: 'Pack supplies', description: '', capacity: 4 }],
    };
    await command('create_event', { ...event, location: place });
    const data = await snapshot();
    assert.equal(data.events.length, 2);
    assert.ok(data.events.every((e) => e.location?.id === place.id));
    await command('update_event', {
      ...event,
      event_id: data.events[0].id,
      starts_at: data.events[0].starts_at,
      city: 'Richmond',
      tasks: data.tasks.filter((task) => task.event_id === data.events[0].id),
    });
    assert.equal((await snapshot()).events.find((e) => e.id === data.events[0].id)?.location, null);
    assert.equal(
      (await snapshot()).events.find((e) => e.id === data.events[1].id)?.location?.id,
      place.id,
    );
    await command('create_event', { ...event, title: 'Legacy City Event', interval: 0, count: 1 });
    assert.equal(
      (await snapshot()).events.find((e) => e.title === 'Legacy City Event')?.location,
      null,
    );
    await assert.rejects(command('profile', { ...profile, location: null }), /Select a city/);
  } finally {
    await db.close();
  }
});
test('provider results are restricted to complete US cities and outages fail closed', async () => {
  const raw = {
    place_id: 'place',
    result_type: 'city',
    country_code: 'us',
    state_code: 'US-VA',
    city: 'Williamsburg',
    lat: 37,
    lon: -76,
  };
  assert.equal(parseCity(raw)?.state_code, 'VA');
  assert.equal(parseCity({ ...raw, result_type: 'street' }), null);
  assert.equal(parseCity({ ...raw, country_code: 'de' }), null);
  assert.equal(parseCity({ ...raw, state_code: 'XX' }), null);
  assert.equal(parseCity({ ...raw, lat: 99 }), null);
  const env = { GEOAPIFY_API_KEY: 'test', AUTH0_SECRET: 'test-secret' };
  let url: URL | undefined;
  const request: typeof fetch = async (input) => {
    url = new URL(String(input));
    return Response.json({ results: [raw, raw, { ...raw, result_type: 'street' }] });
  };
  const result = await searchCities('Williasmbrg', 'auth0|a', env, request);
  assert.equal(url!.searchParams.get('type'), 'city');
  assert.equal(url!.searchParams.get('filter'), 'countrycode:us');
  assert.equal(result.length, 1);
  assert.equal(
    verifyLocation(result[0].token, 'place', 'auth0|a', 'test-secret').city,
    'Williamsburg',
  );
  await assert.rejects(searchCities('Williamsburg', 'auth0|a', {}, request), /not configured/);
  await assert.rejects(
    searchCities('Williamsburg', 'auth0|a', env, async () => new Response('', { status: 503 })),
    /unavailable/,
  );
});
test('demo models all three authentication states and creates organization/group together', () => {
  const state = makeFixtures();
  assert.equal(authenticationState(state), 'ready');
  state.profile = null;
  assert.equal(authenticationState(state), 'signed_out');
  state.onboarding = { display_name: 'New Coordinator' };
  state.pendingUserId = crypto.randomUUID();
  assert.equal(authenticationState(state), 'onboarding');
  const payload = {
    role: 'organization',
    display_name: 'New Coordinator',
    location_id: DEMO_LOCATIONS[1].id,
    organization_name: 'Kentucky Helpers',
    organization_description: 'Local community service events.',
    interests: ['Education'],
  };
  assert.throws(
    () => demoCommand(state, 'onboard', { ...payload, location_id: 'Williasmbrg' }),
    /Select a city/,
  );
  const saved = demoCommand(state, 'onboard', payload);
  assert.equal(authenticationState(saved), 'ready');
  assert.equal(saved.profile?.location?.state_code, 'KY');
  assert.equal(
    saved.groups.find((g) => g.owner_id === saved.profile?.id)?.location?.state_code,
    'KY',
  );
  assert.equal(saved.onboarding, undefined);
  assert.throws(() => demoCommand(saved, 'onboard', payload), /Sign in to complete/);
});
test('upgrade preserves existing locations and failed organization setup rolls back its role', async () => {
  const db = new PGlite();
  try {
    await db.exec(
      await readFile(new URL('../database/migrations/001_foundation.sql', import.meta.url), 'utf8'),
    );
    const { rows } = await db.query<{ id: string }>(
      "select public.app_resolve_user('auth0|migration-test','New User') as id",
    );
    await db.exec(
      await readFile(
        new URL('../database/migrations/002_onboarding_locations.sql', import.meta.url),
        'utf8',
      ),
    );
    assert.deepEqual((await db.query('select city,location from public.profiles')).rows[0], {
      city: 'Williamsburg',
      location: null,
    });
    await db.query("select set_config('app.user_id',$1,false)", [rows[0].id]);
    await db.exec('set role commonly_runtime');
    const command = (payload: unknown) =>
      db.query("select public.app_command('onboard',$1)", [JSON.stringify(payload)]);
    const input = {
      role: 'organization',
      display_name: 'New User',
      location: place,
      organization_name: 'New Group',
      organization_description: 'Valid group description',
      interests: ['Health'],
    };
    await assert.rejects(command({ ...input, location: null }), /Select a city/);
    await assert.rejects(command({ ...input, organization_description: 'x' }), /check constraint/);
    assert.equal(
      (await db.query<{ role: string | null }>('select role from public.users')).rows[0].role,
      null,
    );
    assert.equal(
      (await db.query<{ location: unknown }>('select location from public.profiles')).rows[0]
        .location,
      null,
    );
    await assert.rejects(
      db.query("select private.app_command_v1('onboard',$1)", [JSON.stringify(input)]),
      /permission denied/,
    );
    await command(input);
    const { rows: snapshots } = await db.query<{
      data: {
        profile: { location: { id: string } };
        groups: { location: { id: string }; causes: string[] }[];
      };
    }>('select public.app_snapshot() as data');
    assert.equal(snapshots[0].data.profile.location.id, place.id);
    assert.equal(snapshots[0].data.groups[0].location.id, place.id);
    assert.deepEqual(snapshots[0].data.groups[0].causes, ['Health']);
    await assert.rejects(command(input), /already set/);
  } finally {
    await db.close();
  }
});
