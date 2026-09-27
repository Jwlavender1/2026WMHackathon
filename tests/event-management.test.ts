import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { makeFixtures, fixtureId } from '../src/lib/fixtures';
import { demoCommand } from '../src/lib/demo';
import { eventDeletionReason, hoursServed } from '../src/lib/domain';
import type { Snapshot } from '../src/lib/types';

test('demo event deletion is confirmed, owner-only, and limited to one future occurrence', () => {
  const fixtures = makeFixtures();
  const owner = { ...fixtures, profile: fixtures.profiles[3] };
  const input = { event_id: fixtureId(20), confirmed: true };
  assert.throws(() => demoCommand(fixtures, 'delete_event', input), /manage/);
  assert.throws(
    () => demoCommand({ ...fixtures, profile: fixtures.profiles[4] }, 'delete_event', input),
    /manage/,
  );
  assert.throws(() => demoCommand(owner, 'delete_event', { ...input, confirmed: false }));
  assert.throws(
    () => demoCommand(owner, 'delete_event', { ...input, event_id: fixtureId(25) }),
    /history/,
  );
  const ongoing = structuredClone(owner);
  ongoing.events.find((e) => e.id === input.event_id)!.starts_at = new Date(
    Date.now() - 60000,
  ).toISOString();
  assert.throws(() => demoCommand(ongoing, 'delete_event', input), /history/);
  const attendance = structuredClone(owner);
  attendance.signups[0].verified_minutes = 0;
  assert.match(
    eventDeletionReason(
      attendance.events.find((e) => e.id === input.event_id)!,
      attendance.signups,
    )!,
    /verified attendance/,
  );
  assert.throws(() => demoCommand(attendance, 'delete_event', input), /history/);
  const deleted = demoCommand(owner, 'delete_event', input);
  for (const list of [deleted.tasks, deleted.signups, deleted.comments])
    assert.equal(
      list.some((row) => row.event_id === input.event_id),
      false,
    );
  assert.equal(
    deleted.events.some((e) => e.id === input.event_id),
    false,
  );
  assert.ok(deleted.events.some((e) => e.id === fixtureId(24)));
  assert.ok(deleted.series.some((series) => series.id === fixtureId(30)));
  assert.equal(hoursServed(deleted.signups, fixtureId(1)), 2);
  const last = demoCommand(deleted, 'delete_event', { event_id: fixtureId(24), confirmed: true });
  assert.equal(
    last.series.some((series) => series.id === fixtureId(30)),
    false,
  );
  const cancelled = demoCommand(owner, 'cancel', { event_id: fixtureId(23) });
  assert.equal(
    demoCommand(cancelled, 'delete_event', {
      event_id: fixtureId(23),
      confirmed: true,
    }).events.some((e) => e.id === fixtureId(23)),
    false,
  );
  assert.equal(fixtures.events.length, 6);
});

test('event edit/delete database rules preserve ownership, reservations, history, and atomicity', async () => {
  const db = new PGlite();
  const as = async (id: string | null) => {
    await db.exec('reset role');
    await db.query("select set_config('app.user_id',$1,false)", [id ?? '']);
    await db.exec('set role commonly_runtime');
  };
  const snapshot = async () =>
    (await db.query<{ data: Snapshot }>('select public.app_snapshot() as data')).rows[0].data;
  const erase = (id: string, confirmed: boolean | null = true) =>
    db.query('select public.app_delete_event($1,$2)', [id, confirmed]);
  const command = (kind: string, payload: unknown) =>
    db.query('select public.app_command($1,$2)', [kind, JSON.stringify(payload)]);
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
    const migrations = new URL('../database/migrations/', import.meta.url);
    for (const name of (await readdir(migrations))
      .filter((name) => name.endsWith('.sql') && !name.startsWith('005'))
      .sort())
      await db.exec(await readFile(new URL(name, migrations), 'utf8'));
    const fixture = makeFixtures();
    for (const profile of fixture.profiles) {
      await db.query('insert into public.users(id,auth0_sub,role) values($1,$2,$3)', [
        profile.id,
        `demo:${profile.id}`,
        profile.role,
      ]);
      await db.query('insert into public.profiles(user_id,display_name) values($1,$2)', [
        profile.id,
        profile.display_name,
      ]);
    }
    await insert('groups', fixture.groups);
    await insert('event_series', fixture.series);
    await insert('events', fixture.events);
    await insert(
      'event_tasks',
      fixture.tasks.map(({ reserved: _, ...row }) => row),
    );
    await insert(
      'signups',
      fixture.signups.map(({ display_name: _, ...row }) => row),
    );
    await insert(
      'event_comments',
      fixture.comments.map(({ display_name: _, ...row }) => row),
    );
    await db.exec(await readFile(new URL('005_event_deletion.sql', migrations), 'utf8'));
    await as(null);
    await assert.rejects(erase(fixtureId(20)), /Sign in/);
    await as(fixtureId(1));
    await assert.rejects(erase(fixtureId(20)), /Organization/);
    await as(fixtureId(5));
    await assert.rejects(erase(fixtureId(20)), /manage/);
    await as(fixtureId(4));
    await assert.rejects(erase(fixtureId(20), null), /Confirm/);
    await assert.rejects(erase(fixtureId(20), false), /Confirm/);
    await assert.rejects(erase(fixtureId(25)), /history/);
    await assert.rejects(
      db.query('delete from public.events where id=$1', [fixtureId(20)]),
      /permission denied/,
    );
    const before = await snapshot();
    assert.equal(before.events.length, 6);

    const event = before.events.find((e) => e.id === fixtureId(20))!;
    const edit = {
      ...event,
      event_id: event.id,
      title: 'Updated Pantry Event',
      starts_at: new Date(Date.parse(event.starts_at) + 3600000).toISOString(),
      duration: 120,
      categories: ['Food access', 'Clothing'],
      tasks: before.tasks.filter((t) => t.event_id === event.id),
    };
    await command('update_event', edit);
    let current = await snapshot();
    assert.equal(current.events.find((e) => e.id === event.id)?.title, edit.title);
    assert.deepEqual(current.events.find((e) => e.id === event.id)?.categories, edit.categories);
    assert.deepEqual(current.signups, before.signups);
    await assert.rejects(
      command('update_event', {
        ...edit,
        title: 'Must roll back',
        tasks: edit.tasks.map((task) => ({ ...task, capacity: 0 })),
      }),
      /Capacity|constraint/,
    );
    assert.equal((await snapshot()).events.find((e) => e.id === event.id)?.title, edit.title);
    await as(fixtureId(5));
    await assert.rejects(command('update_event', edit), /manage/);

    // Test the two independent history protections, including a recorded zero-hour attendance.
    await db.exec('reset role');
    await db.query(
      "update public.events set starts_at=now()-interval '1 minute',ends_at=now()+interval '1 hour' where id=$1",
      [fixtureId(23)],
    );
    await as(fixtureId(4));
    await assert.rejects(erase(fixtureId(23)), /started/);
    await db.exec('reset role');
    await db.query(
      'update public.signups set verified_minutes=0,verified_by=$1,verified_at=now() where id=$2',
      [fixtureId(4), fixtureId(40)],
    );
    await as(fixtureId(4));
    await assert.rejects(erase(fixtureId(20)), /verified attendance/);
    await db.exec('reset role');
    await db.query(
      'update public.signups set verified_minutes=null,verified_by=null,verified_at=null where id=$1',
      [fixtureId(40)],
    );
    await db.exec(`create function private.reject_test_event_delete() returns trigger language plpgsql as $$ begin raise exception 'Test event failure'; end $$;
      create trigger reject_test_event_delete before delete on public.events for each row execute function private.reject_test_event_delete();`);
    await as(fixtureId(4));
    const rollbackBaseline = await snapshot();
    await assert.rejects(erase(fixtureId(20)), /Test event failure/);
    assert.deepEqual(await snapshot(), rollbackBaseline);
    await db.exec(
      'reset role; drop trigger reject_test_event_delete on public.events; drop function private.reject_test_event_delete()',
    );

    await as(fixtureId(4));
    await erase(fixtureId(20));
    current = await snapshot();
    assert.equal(
      current.events.some((e) => e.id === fixtureId(20)),
      false,
    );
    assert.equal(
      current.tasks.some((t) => t.event_id === fixtureId(20)),
      false,
    );
    assert.equal(
      current.signups.some((s) => s.event_id === fixtureId(20)),
      false,
    );
    assert.equal(
      current.comments.some((c) => c.event_id === fixtureId(20)),
      false,
    );
    assert.equal(hoursServed(current.signups, fixtureId(1)), 2);
    assert.ok(current.events.some((e) => e.id === fixtureId(24)));
    assert.equal(
      (await db.query<{ count: number }>('select count(*)::int as count from public.event_series'))
        .rows[0].count,
      1,
    );
    await assert.rejects(
      command('join', { event_id: fixtureId(20), task_id: fixtureId(200) }),
      /Event not found/,
    );
    await command('cancel', { event_id: fixtureId(24) });
    await erase(fixtureId(24));
    assert.equal(
      (await db.query<{ count: number }>('select count(*)::int as count from public.event_series'))
        .rows[0].count,
      0,
    );
    await as(fixtureId(1));
    current = await snapshot();
    assert.equal(hoursServed(current.signups, fixtureId(1)), 2);
    assert.ok(current.events.some((e) => e.id === fixtureId(21)));
  } finally {
    await db.close();
  }
});
