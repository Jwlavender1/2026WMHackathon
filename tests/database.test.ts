import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { makeFixtures, fixtureId } from '../src/lib/fixtures';
import type { Snapshot } from '../src/lib/types';
import { DEMO_LOCATIONS } from '../src/lib/location';

test('migration and database permission / integrity contracts', async (t) => {
  const db = new PGlite();
  try {
    const migrations = new URL('../database/migrations/', import.meta.url);
    for (const file of (await readdir(migrations)).filter((name) => name.endsWith('.sql')).sort())
      await db.exec(await readFile(new URL(file, migrations), 'utf8'));
    const f = makeFixtures();
    for (const p of f.profiles) {
      await db.query('insert into public.users(id,auth0_sub,role) values($1,$2,$3)', [
        p.id,
        `demo:${p.id}`,
        p.role,
      ]);
      await db.query(
        'insert into public.profiles(user_id,display_name,bio,city) values($1,$2,$3,$4)',
        [p.id, p.display_name, p.bio, p.city],
      );
    }
    async function insert(table: string, rows: Record<string, unknown>[]) {
      for (const row of rows) {
        const keys = Object.keys(row);
        await db.query(
          `insert into public.${table}(${keys.join(',')}) values(${keys.map((_, i) => `$${i + 1}`).join(',')})`,
          Object.values(row),
        );
      }
    }
    await insert('groups', f.groups);
    await insert('event_series', f.series);
    await insert('events', f.events);
    await insert(
      'event_tasks',
      f.tasks.map(({ reserved: _, ...r }) => r),
    );
    await insert(
      'signups',
      f.signups.map(({ display_name: _, ...r }) => r),
    );
    await insert(
      'event_comments',
      f.comments.map(({ display_name: _, ...r }) => r),
    );
    async function as(id: string | null) {
      await db.exec('reset role');
      await db.query("select set_config('app.user_id',$1,false)", [id ?? '']);
      await db.exec('set role commonly_runtime');
    }
    async function command(kind: string, payload: unknown) {
      return db.query('select public.app_command($1,$2)', [kind, JSON.stringify(payload)]);
    }
    async function snapshot() {
      return (await db.query<{ app_snapshot: Snapshot }>('select public.app_snapshot()')).rows[0]
        .app_snapshot;
    }
    await t.test('anonymous sees public projections without private identities', async () => {
      await as(null);
      const s = await snapshot();
      assert.equal(s.profile, null);
      assert.equal(s.groups.length, 2);
      assert.ok(s.groups.every((g) => !g.owner_id));
      assert.equal(s.signups.length, 0);
      assert.equal(s.comments.length, 0);
      await assert.rejects(db.query('select owner_id from public.groups'), /permission denied/);
      await assert.rejects(
        command('join', { event_id: fixtureId(20), task_id: fixtureId(200) }),
        /Sign in/,
      );
    });
    await t.test(
      'first login is idempotent, onboarding is once-only, and subject mapping stays private',
      async () => {
        await as(null);
        const first = await db.query<{ id: string }>(
          "select public.app_resolve_user('auth0|test-owner','First Organizer') as id",
        );
        const again = await db.query<{ id: string }>(
          "select public.app_resolve_user('auth0|test-owner','Changed Name') as id",
        );
        const id = first.rows[0].id;
        assert.equal(id, again.rows[0].id);
        await as(id);
        assert.equal((await snapshot()).profile, null);
        await assert.rejects(
          command('group', {
            name: 'New group',
            description: 'My community group',
            city: 'Williamsburg',
          }),
          /Complete your profile/,
        );
        await command('onboard', {
          role: 'organization',
          display_name: 'First Organizer',
          city: 'Williamsburg',
          location: DEMO_LOCATIONS[0],
          organization_name: 'First Organization',
          organization_description: 'An organization for testing onboarding.',
          public_contact_email: 'contact@example.org',
          interests: ['Education'],
        });
        assert.equal((await snapshot()).profile?.role, 'organization');
        assert.equal(
          (await snapshot()).groups.find((g) => g.owner_id === id)?.name,
          'First Organization',
        );
        assert.equal((await snapshot()).profile?.location?.state_code, 'VA');
        await assert.rejects(
          command('onboard', { role: 'volunteer', display_name: 'Changed', city: 'Williamsburg' }),
          /already set/,
        );
        assert.ok(!JSON.stringify(await snapshot()).includes('auth0|test-owner'));
      },
    );
    await t.test(
      'avatar data is private, capped, and saved through the owner function',
      async () => {
        await as(fixtureId(1));
        await db.query('select public.app_save_avatar($1,$2)', [
          'image/png',
          new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]),
        ]);
        assert.equal((await db.query('select * from public.profile_images')).rows.length, 1);
        assert.match((await snapshot()).profile!.avatar_path!, /^\/api\/avatar\?v=/);
        await assert.rejects(
          db.query('select public.app_save_avatar($1,$2)', ['image/svg+xml', new Uint8Array([1])]),
          /check constraint/,
        );
        await assert.rejects(
          db.query('select public.app_save_avatar($1,$2)', ['image/png', new Uint8Array(2097153)]),
          /check constraint/,
        );
        await as(fixtureId(2));
        assert.equal((await db.query('select * from public.profile_images')).rows.length, 0);
        await as(null);
        await assert.rejects(
          db.query('select public.app_save_avatar($1,$2)', ['image/png', new Uint8Array([1])]),
          /Sign in/,
        );
      },
    );
    await t.test(
      'volunteer sees only their own records and cannot forge role or hours',
      async () => {
        await as(fixtureId(1));
        const s = await snapshot();
        assert.equal(s.profile?.role, 'volunteer');
        assert.ok(s.signups.every((r) => r.volunteer_id === fixtureId(1)));
        assert.equal(s.comments.length, 1);
        await assert.rejects(
          db.query("update public.users set role='organization'"),
          /permission denied/,
        );
        await assert.rejects(
          db.query('update public.signups set verified_minutes=999'),
          /permission denied/,
        );
        await assert.rejects(
          command('verify', { signup_id: fixtureId(41), minutes: 120 }),
          /do not manage/,
        );
      },
    );
    await t.test('unregistered volunteers cannot see or post event comments', async () => {
      await as(fixtureId(3));
      assert.equal((await snapshot()).comments.length, 0);
      assert.equal((await db.query('select * from public.event_comments')).rows.length, 0);
      await assert.rejects(
        command('comment', { event_id: fixtureId(20), body: 'Hello' }),
        /Reserve a task/,
      );
    });
    await t.test('organizations are isolated', async () => {
      await as(fixtureId(5));
      assert.equal((await snapshot()).signups.length, 0);
      await assert.rejects(command('cancel', { event_id: fixtureId(20) }), /do not manage/);
      await assert.rejects(
        command('verify', { signup_id: fixtureId(41), minutes: 100 }),
        /do not manage/,
      );
    });
    await t.test(
      'last slot cannot be overbooked; retry is idempotent; withdrawal releases it',
      async () => {
        await db.exec('reset role');
        await db.query('update public.event_tasks set capacity=1 where id=$1', [fixtureId(201)]);
        await as(fixtureId(2));
        await command('join', { event_id: fixtureId(20), task_id: fixtureId(201) });
        await command('join', { event_id: fixtureId(20), task_id: fixtureId(201) });
        assert.equal(
          (await snapshot()).signups.filter((s) => s.event_id === fixtureId(20)).length,
          1,
        );
        await as(fixtureId(3));
        await assert.rejects(
          command('join', { event_id: fixtureId(20), task_id: fixtureId(201) }),
          /full/,
        );
        await as(fixtureId(2));
        await command('withdraw', { event_id: fixtureId(20) });
        await as(fixtureId(3));
        await command('join', { event_id: fixtureId(20), task_id: fixtureId(201) });
        assert.equal((await snapshot()).tasks.find((t) => t.id === fixtureId(201))?.reserved, 1);
      },
    );
    await t.test('attendance is bounded and revision updates rather than increments', async () => {
      await as(fixtureId(4));
      await assert.rejects(command('verify', { signup_id: fixtureId(40), minutes: 20 }), /after/);
      await assert.rejects(
        command('verify', { signup_id: fixtureId(41), minutes: 121 }),
        /duration/,
      );
      await command('verify', { signup_id: fixtureId(41), minutes: 60 });
      await command('verify', { signup_id: fixtureId(41), minutes: 60 });
      assert.equal(
        (await snapshot()).signups.find((s) => s.id === fixtureId(41))?.verified_minutes,
        60,
      );
    });
    await t.test('recurrence is atomic and maintains the wall clock over DST', async () => {
      await as(fixtureId(4));
      const year = new Date().getUTCFullYear() + 1;
      const input = {
        title: 'Recurring test',
        description: 'A recurring volunteer opportunity.',
        venue: 'Pantry',
        address: 'Demo',
        city: 'Williamsburg',
        location: DEMO_LOCATIONS[0],
        timezone: 'America/New_York',
        localStart: `${year}-10-25T09:00`,
        duration: 120,
        interval: 1,
        count: 3,
        resources_to_bring: ['Water'],
        tasks: [{ name: 'Pack bags', capacity: 3 }],
      };
      await command('create_event', input);
      const created = (await snapshot()).events.filter((e) => e.title === 'Recurring test');
      assert.equal(created.length, 3);
      assert.equal(new Set(created.map((e) => e.series_id)).size, 1);
      for (const e of created)
        assert.equal(
          new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/New_York',
            hour: 'numeric',
            hour12: false,
          }).format(new Date(e.starts_at)),
          '09',
        );
      const before = (await snapshot()).events.length;
      await assert.rejects(
        command('create_event', { ...input, tasks: [{ name: 'Bad', capacity: 0 }] }),
      );
      assert.equal((await snapshot()).events.length, before);
    });
    await t.test(
      'cancelled events are read-only and other task/event combinations fail',
      async () => {
        await as(fixtureId(4));
        await command('cancel', { event_id: fixtureId(20) });
        await as(fixtureId(1));
        await assert.rejects(
          command('join', { event_id: fixtureId(20), task_id: fixtureId(200) }),
          /closed/,
        );
        await assert.rejects(
          command('comment', { event_id: fixtureId(20), body: 'Hello' }),
          /read-only/,
        );
        await assert.rejects(
          command('join', { event_id: fixtureId(21), task_id: fixtureId(200) }),
          /Task not found/,
        );
      },
    );
  } finally {
    await db.close();
  }
});
