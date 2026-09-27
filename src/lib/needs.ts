import { z } from 'zod';
import { CAUSES, type Location } from './location';
import { eventPhase } from './domain';
import type { DemoState } from './types';

/** Aggregate-only community needs data. Never contains individual volunteers. */
export type NeedCategory = {
  category: string;
  /** Volunteers who chose this cause. null = 1–2 people, withheld for privacy. */
  interested: number | null;
  events: number;
  open_spots: number;
  total_spots: number;
};
export type MapPoint = { lat: number; lng: number; precision: 'address' | 'city' | 'demo' };
export type NeedEvent = {
  id: string;
  title: string;
  group_name: string;
  categories: string[];
  starts_at: string;
  city: string;
  venue: string;
  address: string;
  location: Location | null;
  open_spots: number;
  total_spots: number;
  point?: MapPoint | null;
};
export type NeedsSummary = {
  window_days: number;
  generated_at: string;
  totals: {
    events: number;
    open_spots: number;
    total_spots: number;
    volunteers_with_interests: number | null;
    uncategorized_events: number;
  };
  categories: NeedCategory[];
  events: NeedEvent[];
};

export const INSIGHT_KINDS = ['unmet_interest', 'unfilled_spots', 'no_events', 'balanced'] as const;
export const METRICS = ['interested', 'events', 'open_spots', 'total_spots'] as const;
export type Metric = (typeof METRICS)[number];
export const METRIC_LABELS: Record<Metric, string> = {
  interested: 'Interested volunteers',
  events: 'Upcoming events',
  open_spots: 'Open volunteer spots',
  total_spots: 'Total volunteer spots',
};
export const insightSchema = z.object({
  category: z.enum(CAUSES),
  kind: z.enum(INSIGHT_KINDS),
  headline: z.string().trim().min(8).max(140),
  evidence: z
    .array(z.object({ metric: z.enum(METRICS), value: z.number().int().min(0) }))
    .min(1)
    .max(4),
  action: z.string().trim().min(8).max(240),
});
export type Insight = z.infer<typeof insightSchema>;
export type InsightResult = {
  source: 'gemini' | 'rules';
  insights: Insight[];
  /** Why AI was not used, or what was removed, for the transparency note. */
  note?: string;
};

const count = z.number().int().min(0).max(1_000_000);
/** Only used to accept demo-mode aggregates from the browser. Live data never comes from the client. */
export const aggregateSchema = z.object({
  window_days: z.number().int().min(1).max(90),
  totals: z.object({
    events: count,
    open_spots: count,
    total_spots: count,
    volunteers_with_interests: count.nullable(),
    uncategorized_events: count,
  }),
  categories: z
    .array(
      z.object({
        category: z.enum(CAUSES),
        interested: count.nullable(),
        events: count,
        open_spots: count,
        total_spots: count,
      }),
    )
    .max(CAUSES.length),
});
export type NeedsAggregate = z.infer<typeof aggregateSchema>;
export function toAggregate(summary: NeedsSummary): NeedsAggregate {
  return aggregateSchema.parse({
    window_days: summary.window_days,
    totals: summary.totals,
    categories: summary.categories.filter(
      (c): c is NeedCategory & { category: (typeof CAUSES)[number] } =>
        (CAUSES as readonly string[]).includes(c.category),
    ),
  });
}

/**
 * Fictional venue positions around Williamsburg, VA for the demo workspace only,
 * so the demo map shows separate pins. Live events use real geocoded addresses.
 */
const DEMO_VENUES: Record<string, [number, number]> = {
  'Demo pantry packing room': [37.2797, -76.7252],
  'Demo library sorting room': [37.2734, -76.7101],
  'Demo library meeting room': [37.2712, -76.7162],
  'Demo community kitchen': [37.2641, -76.6968],
};
export function cityPoint(location: Location | null | undefined): MapPoint | null {
  return location ? { lat: location.latitude, lng: location.longitude, precision: 'city' } : null;
}

/** Mirrors private.suppress_small: 1–2 people are withheld so a total cannot single anyone out. */
export const suppressSmall = (n: number) => (n >= 1 && n <= 2 ? null : n);

/** Same aggregation as public.app_community_needs, computed over fictional demo data. */
export function summarizeDemo(data: DemoState, windowDays = 30, now = new Date()): NeedsSummary {
  const end = now.getTime() + windowDays * 86400000;
  const upcoming = data.events.filter(
    (e) =>
      e.status === 'published' &&
      eventPhase(e, now.getTime()) === 'upcoming' &&
      new Date(e.starts_at).getTime() <= end &&
      !data.groups.find((g) => g.id === e.group_id)?.archived_at,
  );
  const spots = (eventId: string) => {
    const tasks = data.tasks.filter((t) => t.event_id === eventId);
    const total = tasks.reduce((sum, t) => sum + t.capacity, 0);
    const open = tasks.reduce((sum, t) => {
      const reserved = data.signups.filter(
        (s) => s.task_id === t.id && s.status === 'active',
      ).length;
      return sum + Math.max(t.capacity - reserved, 0);
    }, 0);
    return { total, open };
  };
  const volunteers = data.profiles.filter((p) => p.role === 'volunteer');
  const names = new Set<string>([
    ...volunteers.flatMap((v) => v.interests ?? []),
    ...upcoming.flatMap((e) => e.categories ?? []),
  ]);
  const events: NeedEvent[] = upcoming
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at) || a.id.localeCompare(b.id))
    .map((e) => {
      const s = spots(e.id);
      const demoVenue = DEMO_VENUES[e.venue];
      return {
        id: e.id,
        title: e.title,
        group_name: data.groups.find((g) => g.id === e.group_id)?.name ?? '',
        categories: e.categories ?? [],
        starts_at: e.starts_at,
        city: e.city,
        venue: e.venue,
        address: e.address,
        location: e.location ?? null,
        open_spots: s.open,
        total_spots: s.total,
        point: demoVenue
          ? { lat: demoVenue[0], lng: demoVenue[1], precision: 'demo' }
          : cityPoint(e.location),
      };
    });
  return {
    window_days: windowDays,
    generated_at: now.toISOString(),
    totals: {
      events: events.length,
      open_spots: events.reduce((sum, e) => sum + e.open_spots, 0),
      total_spots: events.reduce((sum, e) => sum + e.total_spots, 0),
      volunteers_with_interests: suppressSmall(
        volunteers.filter((v) => (v.interests ?? []).length).length,
      ),
      uncategorized_events: events.filter((e) => !e.categories.length).length,
    },
    categories: [...names].sort().map((category) => {
      const matching = events.filter((e) => e.categories.includes(category));
      return {
        category,
        interested: suppressSmall(volunteers.filter((v) => v.interests?.includes(category)).length),
        events: matching.length,
        open_spots: matching.reduce((sum, e) => sum + e.open_spots, 0),
        total_spots: matching.reduce((sum, e) => sum + e.total_spots, 0),
      };
    }),
    events,
  };
}

const people = (n: number) => `${n} volunteer${n === 1 ? '' : 's'}`;
const openSpots = (n: number) => `${n} open spot${n === 1 ? '' : 's'}`;

/** Deterministic gap analysis. Used as the fallback and as the ranking hint given to the AI. */
export function ruleInsights(data: NeedsAggregate, limit = 4): Insight[] {
  const scored = data.categories.flatMap((c): { score: number; insight: Insight }[] => {
    const interested = c.interested ?? 0;
    const known = c.interested !== null;
    const ev = (...metrics: Metric[]) =>
      metrics.flatMap((metric) =>
        c[metric] === null ? [] : [{ metric, value: c[metric] as number }],
      );
    if (known && interested > 0 && c.events === 0)
      return [
        {
          score: 1000 + interested,
          insight: {
            category: c.category,
            kind: 'no_events' as const,
            headline: `${c.category}: ${people(interested)} interested, but no upcoming events`,
            evidence: ev('interested', 'events'),
            action: `Organizations working on ${c.category.toLowerCase()} could post an event — volunteers are ready to show up.`,
          },
        },
      ];
    if (known && interested > c.open_spots)
      return [
        {
          score: 500 + interested - c.open_spots,
          insight: {
            category: c.category,
            kind: 'unmet_interest' as const,
            headline: `${c.category}: ${people(interested)} interested for ${openSpots(c.open_spots)}`,
            evidence: ev('interested', 'open_spots', 'events'),
            action: `Add volunteer roles or another date for ${c.category.toLowerCase()} events so interested neighbors can take part.`,
          },
        },
      ];
    if (c.open_spots >= 5 && c.open_spots > interested * 2)
      return [
        {
          score: 100 + c.open_spots - interested,
          insight: {
            category: c.category,
            kind: 'unfilled_spots' as const,
            headline: `${c.category}: ${openSpots(c.open_spots)} still need volunteers`,
            evidence: known ? ev('open_spots', 'events', 'interested') : ev('open_spots', 'events'),
            action: `Share ${c.category.toLowerCase()} events with student groups and neighbors who have not picked this cause yet.`,
          },
        },
      ];
    return [];
  });
  return scored
    .sort((a, b) => b.score - a.score || a.insight.category.localeCompare(b.insight.category))
    .slice(0, limit)
    .map((s) => s.insight);
}

/**
 * Keeps only insights whose every number is real: each evidence value must equal the
 * database figure for that category and metric, and every number written in the
 * headline or action must appear in that category's figures (or the time window).
 */
export function groundInsights(candidates: unknown[], data: NeedsAggregate) {
  const kept: Insight[] = [];
  let removed = 0;
  const seen = new Set<string>();
  for (const candidate of candidates) {
    const parsed = insightSchema.safeParse(candidate);
    const row = parsed.success
      ? data.categories.find((c) => c.category === parsed.data.category)
      : null;
    if (!parsed.success || !row || seen.has(parsed.data.category)) {
      removed++;
      continue;
    }
    const insight = parsed.data;
    const allowed = new Set(
      [...METRICS.map((m) => row[m]), data.window_days].filter((v): v is number => v !== null),
    );
    const evidenceOk = insight.evidence.every(
      (e) => row[e.metric] !== null && row[e.metric] === e.value,
    );
    const textNumbers = `${insight.headline} ${insight.action}`.match(/\d+(?:[.,]\d+)?/g) ?? [];
    const textOk = textNumbers.every((n) => allowed.has(Number(n.replace(',', ''))));
    if (!evidenceOk || !textOk) {
      removed++;
      continue;
    }
    seen.add(insight.category);
    kept.push(insight);
  }
  return { kept, removed };
}
