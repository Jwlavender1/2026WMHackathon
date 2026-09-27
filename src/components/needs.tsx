'use client';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Info, RefreshCw, Sparkles } from 'lucide-react';
import { useApp } from './provider';
import { PageHeading } from './events';
import { communityInsights, readCommunityNeeds } from '@/app/needs-actions';
import {
  METRIC_LABELS,
  summarizeDemo,
  toAggregate,
  type InsightResult,
  type NeedsSummary,
} from '@/lib/needs';
import type { DemoState } from '@/lib/types';

const NeedsMap = dynamic(() => import('./needs-map'), {
  ssr: false,
  loading: () => <div className="needs-map needs-map-loading">Loading map…</div>,
});
const barWidth = (n: number, max: number) => (n > 0 ? `max(3px, ${(n / max) * 100}%)` : '0');
const shown = (n: number | null) => (n === null ? 'fewer than 3' : String(n));

export function CommunityNeeds() {
  const { data, demo } = useApp();
  const [live, setLive] = useState<NeedsSummary | null>(null);
  const [error, setError] = useState('');
  const [insights, setInsights] = useState<InsightResult | null>(null);
  const [thinking, setThinking] = useState(false);
  const [cause, setCause] = useState('');
  const demoSummary = useMemo(() => (demo ? summarizeDemo(data as DemoState) : null), [demo, data]);
  const summary = demo ? demoSummary : live;

  useEffect(() => {
    if (demo) return;
    let cancelled = false;
    void readCommunityNeeds(30).then((r) => {
      if (cancelled) return;
      if (r.ok) setLive(r.data);
      else setError(r.error);
    });
    return () => {
      cancelled = true;
    };
  }, [demo]);

  const aggregateKey = summary ? JSON.stringify(toAggregate(summary)) : '';
  const explain = async () => {
    if (!aggregateKey) return;
    setThinking(true);
    const r = await communityInsights(demo ? JSON.parse(aggregateKey) : undefined);
    setInsights(r.ok ? r.data : { source: 'rules', insights: [], note: r.error });
    setThinking(false);
  };
  useEffect(() => {
    if (!aggregateKey) return;
    let cancelled = false;
    // Kick off the (cached, server-side) analysis whenever the underlying totals change.
    void communityInsights(demo ? JSON.parse(aggregateKey) : undefined).then((r) => {
      if (!cancelled) setInsights(r.ok ? r.data : { source: 'rules', insights: [], note: r.error });
    });
    return () => {
      cancelled = true;
    };
  }, [aggregateKey, demo]);

  const heading = (
    <PageHeading
      eyebrow="YEAR OF CIVIC LEADERSHIP"
      title="Where help is needed."
      description="See where neighbors want to serve and where opportunities are still open over the next 30 days. Totals only — no individual volunteers are shown."
    />
  );
  if (!summary)
    return (
      <>
        {heading}
        {error ? (
          <div className="empty" role="alert">
            <p>{error}</p>
          </div>
        ) : (
          <div className="skeleton" role="status" aria-label="Loading community needs" />
        )}
      </>
    );

  const events = cause
    ? summary.events.filter((e) => e.categories.includes(cause))
    : summary.events;
  const rows = [...summary.categories].sort(
    (a, b) =>
      (b.interested ?? 0) + b.open_spots - ((a.interested ?? 0) + a.open_spots) ||
      a.category.localeCompare(b.category),
  );
  const max = Math.max(1, ...rows.flatMap((r) => [r.interested ?? 0, r.open_spots]));
  const unmapped = events.filter((e) => e.point?.precision === 'city').length;

  return (
    <div className="needs">
      {heading}
      <section className="needs-tiles" aria-label="Summary for the next 30 days">
        <div className="needs-tile">
          <strong>{summary.totals.events}</strong>
          <span>upcoming events</span>
        </div>
        <div className="needs-tile">
          <strong>{summary.totals.open_spots}</strong>
          <span>open volunteer spots</span>
        </div>
        <div className="needs-tile">
          <strong>{shown(summary.totals.volunteers_with_interests)}</strong>
          <span>volunteers with chosen causes</span>
        </div>
        <div className="needs-tile">
          <strong>
            {summary.categories.filter((c) => (c.interested ?? 0) > 0 && c.events === 0).length}
          </strong>
          <span>causes with interest but no events</span>
        </div>
      </section>

      <section className="panel needs-insights" aria-labelledby="insights-title">
        <div className="needs-section-head">
          <h2 id="insights-title">
            <Sparkles size={20} aria-hidden /> Gaps worth acting on
          </h2>
          <button className="text-button" onClick={() => void explain()} disabled={thinking}>
            <RefreshCw size={16} aria-hidden /> {thinking ? 'Analyzing…' : 'Refresh'}
          </button>
        </div>
        {!insights ? (
          <div className="skeleton" role="status" aria-label="Analyzing community needs" />
        ) : insights.insights.length ? (
          <ul className="needs-insight-list">
            {insights.insights.map((i) => (
              <li key={i.category} className={`needs-insight kind-${i.kind}`}>
                <span className="status-tag">{i.category}</span>
                <h3>{i.headline}</h3>
                <p>{i.action}</p>
                <dl>
                  {i.evidence.map((e) => (
                    <div key={e.metric}>
                      <dt>{METRIC_LABELS[e.metric]}</dt>
                      <dd>{e.value}</dd>
                    </div>
                  ))}
                </dl>
                <button className="text-link" onClick={() => setCause(i.category)}>
                  Show on map <ArrowRight size={15} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">
            No clear gaps yet. As volunteers choose causes and organizations tag events, gaps will
            appear here.
          </p>
        )}
        <p className="needs-transparency">
          <Info size={15} aria-hidden />
          <span>
            {insights?.source === 'gemini'
              ? 'Written by AI (Google Gemini) from the totals below. Every number was checked against the database before showing.'
              : 'Calculated by fixed rules from the totals below.'}{' '}
            {insights?.note} The AI never sees names, profiles, or messages, and it only suggests —
            people decide what to do.
          </span>
        </p>
      </section>

      <div className="needs-filters" role="group" aria-label="Filter by cause">
        <button aria-pressed={!cause} onClick={() => setCause('')}>
          All causes
        </button>
        {summary.categories.map((c) => (
          <button
            key={c.category}
            aria-pressed={cause === c.category}
            onClick={() => setCause(c.category)}
          >
            {c.category}
          </button>
        ))}
      </div>

      <div className="needs-grid">
        <section className="panel" aria-labelledby="map-title">
          <h2 id="map-title">Upcoming events{cause ? ` · ${cause}` : ''}</h2>
          <NeedsMap events={events} />
          <p className="needs-caption">
            Numbers on pins count events at that place; gray pins are full.
            {unmapped > 0 &&
              ` ${unmapped} event${unmapped === 1 ? '' : 's'} shown at the city center because the address could not be mapped.`}
            {demo && ' Demo venues are fictional.'}
          </p>
          {!events.length && (
            <p className="muted">
              No upcoming events{cause ? ` for ${cause}` : ''} in the next 30 days.
            </p>
          )}
        </section>

        <section className="panel" aria-labelledby="gap-title">
          <h2 id="gap-title">Interest vs. open spots</h2>
          <div className="needs-legend" aria-hidden>
            <span>
              <i className="swatch interest" /> Interested volunteers
            </span>
            <span>
              <i className="swatch open" /> Open spots
            </span>
          </div>
          {rows.length ? (
            <ul className="needs-bars">
              {rows.map((r) => (
                <li key={r.category} className={cause && cause !== r.category ? 'is-dim' : ''}>
                  <button
                    className="needs-bar-label"
                    onClick={() => setCause(r.category === cause ? '' : r.category)}
                  >
                    {r.category}
                    <small>
                      {r.events} event{r.events === 1 ? '' : 's'}
                    </small>
                  </button>
                  <div className="needs-bar-pair">
                    <div
                      className="needs-bar-row"
                      title={`${r.category}: ${shown(r.interested)} interested volunteers`}
                    >
                      <span
                        className="needs-bar interest"
                        style={{ width: barWidth(r.interested ?? 0, max) }}
                      />
                      <span className="needs-bar-value">{shown(r.interested)}</span>
                    </div>
                    <div
                      className="needs-bar-row"
                      title={`${r.category}: ${r.open_spots} open of ${r.total_spots} spots`}
                    >
                      <span
                        className="needs-bar open"
                        style={{ width: barWidth(r.open_spots, max) }}
                      />
                      <span className="needs-bar-value">{r.open_spots}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">
              No causes yet. Volunteers can pick causes in{' '}
              <Link className="text-link" href="/profile">
                their profile
              </Link>
              , and organizations can tag events with categories.
            </p>
          )}
          <details className="needs-table">
            <summary>View as table</summary>
            <table>
              <thead>
                <tr>
                  <th scope="col">Cause</th>
                  <th scope="col">Interested</th>
                  <th scope="col">Events</th>
                  <th scope="col">Open spots</th>
                  <th scope="col">Total spots</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.category}>
                    <th scope="row">{r.category}</th>
                    <td>{shown(r.interested)}</td>
                    <td>{r.events}</td>
                    <td>{r.open_spots}</td>
                    <td>{r.total_spots}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
          <p className="needs-caption">
            Counts of 1–2 volunteers are shown as &ldquo;fewer than 3&rdquo; to protect privacy.
            {summary.totals.uncategorized_events > 0 &&
              ` ${summary.totals.uncategorized_events} upcoming event${summary.totals.uncategorized_events === 1 ? ' has' : 's have'} no category yet.`}
          </p>
        </section>
      </div>
    </div>
  );
}
