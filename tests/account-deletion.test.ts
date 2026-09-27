import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { demoCommand } from '../src/lib/demo';
import { deleteAccountSchema, hoursServed } from '../src/lib/domain';
import { makeFixtures, fixtureId } from '../src/lib/fixtures';
import type { Snapshot } from '../src/lib/types';

test('demo deletion requires confirmation and preserves other accounts and organization service history', () => {
  const original = makeFixtures();
  assert.throws(() => demoCommand(original, 'delete_account', {}));
  assert.throws(
    () => demoCommand({ ...original, profile: null }, 'delete_account', { confirmation: 'DELETE' }),
    /Sign in/,
  );
  assert.equal(
    deleteAccountSchema.safeParse({ confirmation: 'DELETE', user_id: fixtureId(2) }).success,
    false,
  );
  const volunteer = demoCommand(original, 'delete_account', { confirmation: 'DELETE' });
  assert.equal(volunteer.profile, null);
  assert.equal(
    volunteer.profiles.some((p) => p.id === fixtureId(1)),
    false,
  );
  assert.equal(
    volunteer.signups.some((s) => s.volunteer_id === fixtureId(1)),
    false,
  );
  assert.equal(
    volunteer.comments.some((c) => c.author_id === fixtureId(1)),
    false,
  );
  assert.equal(volunteer.tasks.find((t) => t.id === fixtureId(200))!.reserved, 0);
  assert.equal(hoursServed(volunteer.signups, fixtureId(2)), 1.5);
  assert.deepEqual(volunteer.events, original.events);

  const organization = demoCommand(
    { ...original, profile: original.profiles[3] },
    'delete_account',
    { confirmation: 'DELETE' },
  );
  const archived = organization.groups.find((g) => g.id === fixtureId(10))!;
  assert.equal(archived.owner_id, null);
  assert.ok(archived.archived_at);
  assert.equal(archived.location, null);
  assert.equal(archived.public_contact_email, null);
  assert.equal(
    organization.profiles.some((p) => p.id === fixtureId(4)),
    false,
  );
  assert.ok(
    organization.events
      .filter((e) => e.group_id === archived.id && Date.parse(e.ends_at) > Date.now())
      .every((e) => e.status === 'cancelled'),
  );
  assert.deepEqual(
    organization.events.find((e) => e.id === fixtureId(25)),
    original.events.find((e) => e.id === fixtureId(25)),
  );
  assert.equal(hoursServed(organization.signups, fixtureId(1)), 2);
  assert.equal(hoursServed(organization.signups, fixtureId(2)), 1.5);
  assert.ok(
    organization.signups
      .filter((s) => s.verified_minutes !== null)
      .every((s) => s.verified_by === null && s.verified_at),
  );
  assert.deepEqual(
    organization.groups.find((g) => g.id === fixtureId(11)),
    original.groups.find((g) => g.id === fixtureId(11)),
  );
  assert.equal(original.profiles.length, 5);
});

test('database deletion is self-only, atomic, revokes stale identities, and preserves verified hours', async () => {
  const db = new PGlite();
  const migrate = async (name: string) =>
    db.exec(await readFile(new URL(`../database/migrations/${name}`, import.meta.url), 'utf8'));
  const as = async (id: string | null) => {
    await db.exec('reset role');
    await db.query("select set_config('app.user_id',$1,false)", [id ?? '']);
    await db.exec('set role commonly_runtime');
  };
  const snapshot = async () =>
    (await db.query<{ value: Snapshot }>('select public.app_snapshot() as value')).rows[0].value;
  const erase = (confirmation: string | null) =>
    db.query('select public.app_delete_account($1)', [confirmation]);
  const resolve = async (id: string, createdAt: number | null) =>
    (
      await db.query<{ id: string | null }>(
        'select public.app_resolve_user($1,$2,$3::bigint) as id',
        [`demo:${id}`, 'Returning member', createdAt],
      )
    ).rows[0].id;
  const insert = async (table: string, rows: Record<string, unknown>[]) => {
    for (const row of rows) {
      const keys = Object.keys(row);
      await db.query(
        `insert into public.${table}(${keys.join(',')}) values(${keys.map((_, i) => `$${i + 1}`).join(',')})`,
        Object.values(row),
      );
    }
  };
  try {
    for (const name of [
      '001_foundation.sql',
      '002_onboarding_locations.sql',
      '003_event_categories.sql',
    ])
      await migrate(name);
    const fixtures = makeFixtures();
    for (const profile of fixtures.profiles) {
      await db.query('insert into public.users(id,auth0_sub,role) values($1,$2,$3)', [
        profile.id,
        `demo:${profile.id}`,
        profile.role,
      ]);
      await db.query(
        'insert into public.profiles(user_id,display_name,bio,city,location) values($1,$2,$3,$4,$5)',
        [profile.id, profile.display_name, profile.bio, profile.city, profile.location],
      );
    }
    await insert('groups', fixtures.groups);
    await insert('event_series', fixtures.series);
    await insert('events', fixtures.events);
    await insert(
      'event_tasks',
      fixtures.tasks.map(({ reserved: _, ...row }) => row),
    );
    await insert(
      'signups',
      fixtures.signups.map(({ display_name: _, ...row }) => row),
    );
    await insert(
      'event_comments',
      fixtures.comments.map(({ display_name: _, ...row }) => row),
    );
    await db.query(
      "insert into public.profile_images(user_id,mime_type,content) values($1,'image/png',$2),($3,'image/png',$2)",
      [fixtureId(1), new Uint8Array([1, 2, 3]), fixtureId(4)],
    );
    await migrate('004_account_deletion.sql');
    assert.equal(
      (await db.query<{ count: number }>('select count(*)::int as count from public.users')).rows[0]
        .count,
      5,
    );

    await as(null);
    await assert.rejects(erase('DELETE'), /Sign in/);
    await assert.rejects(db.query('select * from private.deleted_accounts'), /permission denied/);
    await as(fixtureId(1));
    await assert.rejects(erase(null), /Type DELETE/);
    await assert.rejects(erase('delete'), /Type DELETE/);
    await assert.rejects(db.query('delete from public.users'), /permission denied/);
    assert.equal((await snapshot()).profile?.id, fixtureId(1));

    // A late failure rolls back cancellations, archival, fingerprints, and data removal.
    await db.exec('reset role');
    await db.exec(`create function private.reject_test_delete() returns trigger language plpgsql as $$ begin raise exception 'Test deletion failure'; end $$;
      create trigger reject_test_delete before delete on public.users for each row execute function private.reject_test_delete();`);
    await as(fixtureId(4));
    await assert.rejects(erase('DELETE'), /Test deletion failure/);
    let data = await snapshot();
    assert.equal(data.profile?.id, fixtureId(4));
    assert.equal(data.groups.find((g) => g.id === fixtureId(10))?.archived_at, null);
    assert.equal(data.events.find((e) => e.id === fixtureId(20))?.status, 'published');
    assert.ok(
      data.signups.every((s) => s.verified_minutes === null || s.verified_by === fixtureId(4)),
    );
    await db.exec(
      'reset role; drop trigger reject_test_delete on public.users; drop function private.reject_test_delete()',
    );
    assert.equal(
      (
        await db.query<{ count: number }>(
          'select count(*)::int as count from private.deleted_accounts',
        )
      ).rows[0].count,
      0,
    );

    // Volunteer erasure releases places and removes only that user's personal records.
    await as(fixtureId(1));
    await erase('DELETE');
    await as(fixtureId(4));
    data = await snapshot();
    assert.equal(
      data.signups.some((s) => s.volunteer_id === fixtureId(1)),
      false,
    );
    assert.equal(data.tasks.find((t) => t.id === fixtureId(200))?.reserved, 0);
    assert.equal(hoursServed(data.signups, fixtureId(2)), 1.5);
    await db.exec('reset role');
    for (const [table, column] of [
      ['users', 'id'],
      ['profiles', 'user_id'],
      ['profile_images', 'user_id'],
      ['event_comments', 'author_id'],
    ]) {
      const removed = await db.query<{ count: number }>(
        `select count(*)::int as count from public.${table} where ${column}=$1`,
        [fixtureId(1)],
      );
      assert.equal(removed.rows[0].count, 0, table);
    }
    await as(null);
    const oldSession = Math.floor(Date.now() / 1000) - 60;
    assert.equal(await resolve(fixtureId(1), oldSession), null);
    assert.equal(await resolve(fixtureId(1), null), null);
    assert.equal(
      (
        await db.query<{ id: string | null }>('select public.app_resolve_user($1,$2) as id', [
          `demo:${fixtureId(1)}`,
          'Old server',
        ])
      ).rows[0].id,
      null,
    );
    const freshSession = Math.floor(Date.now() / 1000) + 2;
    const replacement = await resolve(fixtureId(1), freshSession);
    assert.ok(replacement);
    assert.notEqual(replacement, fixtureId(1));
    assert.equal(await resolve(fixtureId(1), oldSession), null);
    await as(replacement);
    assert.equal((await snapshot()).profile, null); // Fresh onboarding, not recovered profile/hours.
    await assert.rejects(
      db.query("select public.app_command('comment',$1)", [
        JSON.stringify({ event_id: fixtureId(20), body: 'Old privileges must not survive.' }),
      ]),
      /Complete your profile/,
    );

    // Organization closure cancels future/ongoing events while retaining history.
    await db.exec('reset role');
    await db.query(
      "update public.events set starts_at=now()-interval '30 minutes',ends_at=now()+interval '30 minutes' where id=$1",
      [fixtureId(23)],
    );
    await as(fixtureId(4));
    await erase('DELETE');
    await as(fixtureId(2));
    data = await snapshot();
    const archived = data.groups.find((g) => g.id === fixtureId(10))!;
    assert.ok(archived.archived_at);
    assert.equal(archived.name, 'Williamsburg House of Mercy');
    assert.equal(archived.website_url, null);
    assert.equal(archived.public_contact_email, null);
    assert.equal(archived.location, null);
    assert.equal(data.events.find((e) => e.id === fixtureId(20))?.status, 'cancelled');
    assert.equal(data.events.find((e) => e.id === fixtureId(23))?.status, 'cancelled');
    assert.equal(data.events.find((e) => e.id === fixtureId(25))?.status, 'published');
    assert.equal(data.events.find((e) => e.id === fixtureId(22))?.status, 'published');
    assert.equal(hoursServed(data.signups, fixtureId(2)), 1.5);
    assert.equal(data.signups.find((s) => s.id === fixtureId(42))?.verified_by, null);
    assert.ok(data.signups.find((s) => s.id === fixtureId(42))?.verified_at);
    await assert.rejects(
      db.query("select public.app_command('join',$1)", [
        JSON.stringify({ event_id: fixtureId(20), task_id: fixtureId(200) }),
      ]),
      /Reservations are closed/,
    );
    await as(null);
    assert.equal(await resolve(fixtureId(4), oldSession), null);
    await db.exec('reset role');
    assert.equal(
      (
        await db.query<{ count: number }>(
          'select count(*)::int as count from public.profile_images',
        )
      ).rows[0].count,
      0,
    );
    assert.equal(
      (
        await db.query<{ count: number }>(
          'select count(*)::int as count from public.event_comments where author_id=$1',
          [fixtureId(4)],
        )
      ).rows[0].count,
      0,
    );
    assert.equal(
      (
        await db.query<{ count: number }>(
          'select count(*)::int as count from public.users where id=$1',
          [fixtureId(5)],
        )
      ).rows[0].count,
      1,
    );
  } finally {
    await db.close();
  }
});
