'use server';
import { appMode } from '@/lib/config';
import { auth0 } from '@/lib/auth0';
import { withDatabaseUser } from '@/lib/db/server';
import { geocodeVenue } from '@/lib/geocoding';
import { explainNeeds } from '@/lib/gemini';
import { locationSchema } from '@/lib/location';
import {
  aggregateSchema,
  cityPoint,
  toAggregate,
  type InsightResult,
  type NeedsSummary,
} from '@/lib/needs';
import type { Result } from '@/lib/types';

async function liveSummary(windowDays: number): Promise<NeedsSummary> {
  if (!(await auth0().getSession())?.user.sub) throw new Error('Sign in to view community needs.');
  return withDatabaseUser(async (client) => {
    const { rows } = await client.query<{ data: NeedsSummary }>(
      'SELECT public.app_community_needs($1::integer) AS data',
      [windowDays],
    );
    return rows[0].data;
  }, true);
}

/** Map + chart data. Live mode reads aggregates from PostgreSQL; demo mode computes them in the browser. */
export async function readCommunityNeeds(windowDays = 30): Promise<Result<NeedsSummary>> {
  try {
    if (appMode() !== 'live') throw new Error('Community needs are computed locally in demo mode.');
    const days = Math.min(90, Math.max(1, Math.trunc(Number(windowDays)) || 30));
    const summary = await liveSummary(days);
    // Place pins at street level when the public event address can be geocoded; otherwise at the city.
    const queue = [...summary.events];
    const worker = async () => {
      for (let event = queue.shift(); event; event = queue.shift()) {
        const city = locationSchema.safeParse(event.location);
        const point = city.success ? await geocodeVenue(event.address, city.data) : null;
        event.point = point ? { ...point, precision: 'address' } : cityPoint(event.location);
      }
    };
    await Promise.all(Array.from({ length: 5 }, worker));
    return { ok: true, data: summary };
  } catch (error) {
    return { ok: false, error: friendly(error, 'Community needs are unavailable right now.') };
  }
}
function friendly(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : '';
  if (/app_community_needs/.test(message))
    return 'The community needs map is waiting on a database update (migration 006). Please try again later.';
  return message || fallback;
}

/**
 * AI gap insights. In live mode the server re-reads aggregates itself and ignores the browser;
 * in demo mode it accepts fictional demo aggregates validated by a strict schema.
 */
export async function communityInsights(demoAggregate?: unknown): Promise<Result<InsightResult>> {
  try {
    const data =
      appMode() === 'live'
        ? toAggregate(await liveSummary(30))
        : aggregateSchema.parse(demoAggregate);
    return { ok: true, data: await explainNeeds(data) };
  } catch (error) {
    return { ok: false, error: friendly(error, 'Insights are unavailable right now.') };
  }
}
