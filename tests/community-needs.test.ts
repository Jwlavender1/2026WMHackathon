import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { makeFixtures } from '../src/lib/fixtures';
import {
  groundInsights,
  ruleInsights,
  summarizeDemo,
  toAggregate,
  type NeedsAggregate,
  type NeedsSummary,
} from '../src/lib/needs';
import { explainNeeds } from '../src/lib/needs-ai';

const sample: NeedsAggregate = {
  window_days: 30,
  totals: {
    events: 5,
    open_spots: 26,
    total_spots: 40,
    volunteers_with_interests: 40,
    uncategorized_events: 0,
  },
  categories: [
    { category: 'Food access', interested: 40, events: 2, open_spots: 6, total_spots: 10 },
    { category: 'Education', interested: 5, events: 3, open_spots: 20, total_spots: 30 },
    { category: 'Environment', interested: 12, events: 0, open_spots: 0, total_spots: 0 },
    { category: 'Health', interested: null, events: 0, open_spots: 0, total_spots: 0 },
  ],
};

test('rule insights rank causes with interest but no events first and never use withheld counts', () => {
  const insights = ruleInsights(sample);
  assert.deepEqual(
    insights.map((i) => [i.category, i.kind]),
    [
      ['Environment', 'no_events'],
      ['Food access', 'unmet_interest'],
      ['Education', 'unfilled_spots'],
    ],
  );
  assert.ok(!insights.some((i) => i.category === 'Health'));
  assert.equal(groundInsights(insights, sample).kept.length, insights.length);
});

test('grounding drops AI insights with invented or mismatched numbers', () => {
  const good = {
    category: 'Food access',
    kind: 'unmet_interest',
    headline: 'Food access: 40 volunteers want to help, only 6 spots open',
    evidence: [
      { metric: 'interested', value: 40 },
      { metric: 'open_spots', value: 6 },
    ],
    action: 'Pantries could add a second shift this month.',
  };
  const { kept, removed } = groundInsights(
    [
      good,
      { ...good, category: 'Education', headline: 'Education demand is up 300% this term' },
      { ...good, category: 'Environment', evidence: [{ metric: 'interested', value: 13 }] },
      { ...good, category: 'Health', evidence: [{ metric: 'interested', value: 0 }] },
      { ...good, category: 'Not a cause' },
      good,
    ],
    sample,
  );
  assert.deepEqual(
    kept.map((i) => i.category),
    ['Food access'],
  );
  assert.equal(removed, 5);
});

test('AI explanations fall back to rules without a key, on errors, and on unverifiable output', async () => {
  const noKey = await explainNeeds(sample, {});
  assert.equal(noKey.source, 'rules');
  assert.ok(noKey.insights.length);

  let request: { url: string; body: string; key: string } | null = null;
  const reply = (insights: unknown[]) =>
    (async (url: string | URL | Request, init?: RequestInit) => {
      request = {
        url: String(url),
        body: String(init?.body),
        key: String((init?.headers as Record<string, string>)['x-goog-api-key']),
      };
      return Response.json({
        candidates: [{ content: { parts: [{ text: JSON.stringify({ insights }) }] } }],
      });
    }) as typeof fetch;
  const ai = await explainNeeds(
    sample,
    { GEMINI_API_KEY: 'test-key', GEMINI_MODEL: 'test-model' },
    reply([
      {
        category: 'Environment',
        kind: 'no_events',
        headline: 'Environment: 12 volunteers are waiting for an event',
        evidence: [
          { metric: 'interested', value: 12 },
          { metric: 'events', value: 0 },
        ],
        action: 'A campus clean-up would give these volunteers a place to start.',
      },
      {
        category: 'Food access',
        kind: 'unmet_interest',
        headline: 'Food access interest is 7x the open spots',
        evidence: [{ metric: 'interested', value: 40 }],
        action: 'Add more pantry shifts.',
      },
    ]),
    1_000,
  );
  assert.equal(ai.source, 'gemini');
  assert.deepEqual(
    ai.insights.map((i) => i.category),
    ['Environment'],
  );
  assert.match(ai.note ?? '', /1 AI suggestion was removed/);
  assert.ok(request);
  const sent = request as { url: string; body: string; key: string };
  assert.match(sent.url, /models\/test-model:generateContent$/);
  assert.equal(sent.key, 'test-key');
  // Only aggregates are sent: no event titles, addresses, or people.
  assert.doesNotMatch(sent.body, /address|display_name|title|auth0/);

  const cached = await explainNeeds(
    sample,
    { GEMINI_API_KEY: 'test-key' },
    (() => {
      throw new Error('should use cache');
    }) as typeof fetch,
    2_000,
  );
  assert.equal(cached.source, 'gemini');

  const changed = { ...sample, window_days: 14 };
  const failed = await explainNeeds(
    changed,
    { GEMINI_API_KEY: 'k' },
    (async () => new Response('nope', { status: 500 })) as typeof fetch,
    3_000,
  );
  assert.equal(failed.source, 'rules');
  assert.match(failed.note ?? '', /temporarily unavailable/);
});

test('demo summary matches fixture data and shows fictional gaps', () => {
  const demo = makeFixtures();
  const summary = summarizeDemo(demo);
  const env = summary.categories.find((c) => c.category === 'Environment');
  assert.deepEqual(env, {
    category: 'Environment',
    interested: 3,
    events: 0,
    open_spots: 0,
    total_spots: 0,
  });
  assert.ok(summary.events.every((e) => e.point));
  assert.equal(summary.totals.volunteers_with_interests, 3);
  assert.equal(ruleInsights(toAggregate(summary))[0].category, 'Environment');
});

test('community needs SQL returns only aggregates, suppresses small counts, and requires sign-in', async () => {
  const db = new PGlite();
  try {
    const dir = new URL('../database/migrations/', import.meta.url);
    for (const file of (await readdir(dir)).filter((n) => n.endsWith('.sql')).sort())
      await db.exec(await readFile(new URL(file, dir), 'utf8'));
    const f = makeFixtures();
    for (const p of f.profiles) {
      await db.query('insert into public.users(id,auth0_sub,role) values($1,$2,$3)', [
        p.id,
        `demo:${p.id}`,
        p.role,
      ]);
      await db.query(
        'insert into public.profiles(user_id,display_name,city,interests) values($1,$2,$3,$4)',
        [p.id, p.display_name, p.city, p.interests],
      );
    }
    const insert = async (table: string, rows: Record<string, unknown>[]) => {
      for (const row of rows) {
        const keys = Object.keys(row);
        await db.query(
          `insert into public.${table}(${keys.join(',')}) values(${keys.map((_, i) => `$${i + 1}`).join(',')})`,
          Object.values(row),
        );
      }
    };
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
    const as = async (id: string | null) => {
      await db.exec('reset role');
      await db.query("select set_config('app.user_id',$1,false)", [id ?? '']);
      await db.exec('set role commonly_runtime');
    };
    const read = async () =>
      (await db.query<{ data: NeedsSummary }>('select public.app_community_needs(30) as data'))
        .rows[0].data;

    await as(null);
    await assert.rejects(read(), /Sign in/);
    await as(f.profiles[0].id);
    await assert.rejects(db.query('select public.app_community_needs(365)'), /between 1 and 90/);
    const data = await read();
    const demo = summarizeDemo(f);
    // SQL and the demo computation agree on every total, including privacy suppression.
    const byName = (s: NeedsSummary) =>
      Object.fromEntries(
        s.categories.map((c) => [
          c.category,
          [c.interested, c.events, c.open_spots, c.total_spots],
        ]),
      );
    assert.deepEqual(byName(data), byName(demo));
    // 3 volunteers chose Environment and Health (shown); 2 chose Food access, 1 Housing (withheld).
    assert.equal(data.categories.find((c) => c.category === 'Environment')?.interested, 3);
    assert.equal(data.categories.find((c) => c.category === 'Food access')?.interested, null);
    assert.equal(data.categories.find((c) => c.category === 'Housing')?.interested, null);
    assert.equal(data.totals.events, demo.totals.events);
    assert.equal(data.totals.open_spots, demo.totals.open_spots);
    assert.doesNotMatch(JSON.stringify(data), /Maya|Jordan|Alex|auth0|demo:0000/);
    // The runtime role still cannot read other volunteers' interests directly.
    const direct = await db.query('select interests from public.profiles');
    assert.equal(direct.rows.length, 1);
  } finally {
    await db.exec('reset role').catch(() => {});
    await db.close();
  }
});
