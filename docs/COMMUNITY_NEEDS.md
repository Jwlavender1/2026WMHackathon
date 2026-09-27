# Community needs map

**Status:** implemented on the `feature/community-needs-map` branch. Demo mode works with no setup. Live mode needs migration 006 and, for AI-written insights, a Gemini API key.

`/needs` ("Needs map" in the navigation) shows signed-in users where volunteer interest and open opportunities don't match over the next 30 days. It's meant for organizations, student groups, and campus leaders (for example, a Year of Civic Leadership dashboard).

## What it shows

- **Summary tiles:** upcoming events, open volunteer spots, volunteers who chose causes, and causes with interest but no events.
- **Gaps worth acting on:** up to four insight cards. Each one has a headline, one suggested action, and the exact numbers it relies on.
- **Map:** Leaflet with OpenStreetMap tiles (free, no key). Events at the same place share a numbered pin, and gray pins are full. Live events are placed by geocoding their public address with Geoapify. An event whose address can't be matched within 40 km of its city is shown at the city center with a dashed pin and a caption. Demo venues have fictional positions.
- **Interest vs. open spots:** paired bars per cause, with a legend, visible values, and a "View as table" option. Clicking a cause filters the map and chart.

## How the data stays private

- `public.app_community_needs(window_days)` (migration 006) is a `security definer` function. It returns **totals only**: counts per cause and a list of public event details. It never returns volunteers, profiles, names, emails, or Auth0 IDs. It requires a signed-in user who has finished onboarding.
- Volunteer counts of 1–2 are returned as `null` and shown as "fewer than 3", so a total can't point to a specific neighbor. The demo applies the same rule.
- The runtime database login still cannot read other people's profiles directly. The function is the only path, and it releases aggregates only.

## How the AI works

- `src/lib/needs-ai.ts` sends Gemini **only the category totals** (no event titles, addresses, or people). It uses structured JSON output with a fixed schema, temperature 0.2, a 20-second timeout, a one-hour cache, and a limit of 30 calls per hour per server.
- **Grounding check:** each insight's evidence values must equal the database figure for that cause and metric, and every number written in the headline or action must appear in that cause's figures. Anything else is dropped, and the page notes how many suggestions were removed.
- If there's no key, Gemini returns an error, or nothing passes the check, the page shows **rule-based insights** from `ruleInsights()` and labels them "Calculated by fixed rules". The page always says which source produced the cards.
- In live mode the server re-reads totals from the database itself and ignores anything sent by the browser. In demo mode it accepts fictional demo totals, validated by a strict Zod schema.

## Setup

1. **Database:** `npm run db:migrate` from a trusted machine (applies `006_community_needs.sql`). No new grants are needed beyond what the migration includes.
2. **Gemini key:** create a key in Google AI Studio and set `GEMINI_API_KEY` in `.env.local` and as an **encrypted** DigitalOcean app variable. Optionally set `GEMINI_MODEL` (default `gemini-flash-latest`).
3. **Street-level pins (optional):** uses the existing `GEOAPIFY_API_KEY`.

## Files

`database/migrations/006_community_needs.sql` · `src/lib/needs.ts` (types, demo aggregation, rules, grounding) · `src/lib/needs-ai.ts` + `src/lib/gemini.ts` (server-only AI call) · `src/app/needs-actions.ts` (server actions) · `src/components/needs.tsx`, `needs-map.tsx` · tests in `tests/community-needs.test.ts` and `tests/e2e/community-needs.spec.ts`.
