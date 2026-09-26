import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eventSchema, occurrences, hoursServed, eventPhase } from '../src/lib/domain';
import { makeFixtures, fixtureId } from '../src/lib/fixtures';
import { demoCommand } from '../src/lib/demo';

const form = {
  title: 'Community pantry',
  description: 'Sort and pack grocery bags with neighbors.',
  venue: 'Pantry',
  address: 'Demo address',
  city: 'Williamsburg',
  location_id: 'demo:williamsburg-va',
  location_token: '',
  localStart: '2026-10-25T09:00',
  timezone: 'America/New_York',
  duration: 120,
  resources: 'Water',
  interval: 1,
  count: 3,
  tasks: [{ name: 'Pack bags', capacity: 4, description: '' }],
};
test('recurrence preserves local time across daylight saving, with unique UTC instants', () => {
  const dates = occurrences(eventSchema.parse(form), Date.parse('2026-09-26'));
  assert.equal(dates.length, 3);
  assert.equal(dates[0].starts_at, '2026-10-25T13:00:00.000Z');
  assert.equal(dates[1].starts_at, '2026-11-01T14:00:00.000Z');
});
test('ambiguous and nonexistent local times are rejected', () => {
  assert.throws(
    () => occurrences({ ...form, localStart: '2026-11-01T01:30' }, Date.parse('2026-01-01')),
    /unambiguous/,
  );
  assert.throws(
    () => occurrences({ ...form, localStart: '2026-03-08T02:30' }, Date.parse('2026-01-01')),
    /unambiguous/,
  );
  assert.throws(
    () => occurrences({ ...form, localStart: '2026-03-01T02:30' }, Date.parse('2026-01-01')),
    /daylight saving/,
  );
});
test('fixtures include five future occurrences, both groups, history, and exact hours', () => {
  const now = new Date();
  const f = makeFixtures(now);
  assert.equal(f.groups.length, 2);
  assert.equal(f.events.filter((e) => eventPhase(e, now.getTime()) === 'upcoming').length, 5);
  assert.equal(hoursServed(f.signups, fixtureId(1)), 2);
  assert.equal(hoursServed(f.signups, fixtureId(2)), 1.5);
  assert.equal(hoursServed(f.signups, fixtureId(3)), 0);
});
test('demo rejects forged hours and other organization management', () => {
  const f = makeFixtures();
  assert.throws(
    () => demoCommand(f, 'verify', { signup_id: fixtureId(41), minutes: 300 }),
    /cannot verify/,
  );
  f.profile = f.profiles[4];
  assert.throws(() => demoCommand(f, 'cancel', { event_id: fixtureId(20) }), /Only your/);
});
test('verification revisions replace hours and cancelled events refuse reservations', () => {
  let f = makeFixtures();
  f.profile = f.profiles[3];
  f = demoCommand(f, 'verify', { signup_id: fixtureId(41), minutes: 90 });
  assert.equal(hoursServed(f.signups, fixtureId(1)), 1.5);
  f = demoCommand(f, 'verify', { signup_id: fixtureId(41), minutes: 90 });
  assert.equal(hoursServed(f.signups, fixtureId(1)), 1.5);
  f = demoCommand(f, 'cancel', { event_id: fixtureId(20) });
  f.profile = f.profiles[2];
  assert.throws(
    () => demoCommand(f, 'join', { event_id: fixtureId(20), task_id: fixtureId(200) }),
    /closed/,
  );
});
