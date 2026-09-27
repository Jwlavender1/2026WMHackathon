// Provider-neutral core with injectable env/fetch for tests. Import it through ./gemini on the server.
import { createHash } from 'node:crypto';
import { CAUSES } from './location';
import {
  INSIGHT_KINDS,
  METRICS,
  groundInsights,
  ruleInsights,
  type InsightResult,
  type NeedsAggregate,
} from './needs';

const SYSTEM = `You help community leaders in Williamsburg, Virginia see where volunteer interest and available service opportunities do not match.
You receive ONLY aggregate counts per cause category for the next N days:
- interested: volunteers who selected the cause (null means 1-2 people, withheld for privacy; never guess it)
- events: upcoming published events tagged with the cause
- open_spots / total_spots: volunteer spots still open / offered across those events
Rules:
- Use ONLY numbers that appear in the input for that same category. Never invent, estimate, add up, or compute percentages.
- Each insight's evidence must list the exact metric values you relied on.
- Prefer the biggest gaps: causes people care about with few or no opportunities, and opportunities with many open spots.
- Suggest one concrete, respectful action an organization, student group, or campus office could take. Do not name or guess at individuals.
- The "rule_based_hints" are a deterministic ranking; you may reorder or rephrase them but must stay factual.
- Return at most 4 insights, one per category. Plain language, no hype.`;

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    insights: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          category: { type: 'STRING', enum: [...CAUSES] },
          kind: { type: 'STRING', enum: [...INSIGHT_KINDS] },
          headline: { type: 'STRING' },
          evidence: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                metric: { type: 'STRING', enum: [...METRICS] },
                value: { type: 'INTEGER' },
              },
              required: ['metric', 'value'],
            },
          },
          action: { type: 'STRING' },
        },
        required: ['category', 'kind', 'headline', 'evidence', 'action'],
      },
    },
  },
  required: ['insights'],
};

const cache = new Map<string, { at: number; result: InsightResult }>();
const CACHE_MS = 60 * 60 * 1000;
const calls: number[] = [];
const MAX_CALLS_PER_HOUR = 30;

function fallback(data: NeedsAggregate, note: string): InsightResult {
  return { source: 'rules', insights: ruleInsights(data), note };
}

/**
 * Asks Gemini to explain gaps in aggregate data. Every returned number is checked against
 * the input; anything unverifiable is dropped. Any failure falls back to rule-based insights.
 */
export async function explainNeeds(
  data: NeedsAggregate,
  env: Record<string, string | undefined> = process.env,
  request: typeof fetch = fetch,
  now = Date.now(),
): Promise<InsightResult> {
  if (!data.categories.length)
    return {
      source: 'rules',
      insights: [],
      note: 'No categorized events or volunteer interests yet.',
    };
  const key = env.GEMINI_API_KEY?.trim();
  if (!key)
    return fallback(data, 'AI insights are not configured, so these were calculated by rules.');
  const hash = createHash('sha256').update(JSON.stringify(data)).digest('hex');
  const hit = cache.get(hash);
  if (hit && now - hit.at < CACHE_MS) return hit.result;
  while (calls.length && now - calls[0] > CACHE_MS) calls.shift();
  if (calls.length >= MAX_CALLS_PER_HOUR)
    return fallback(data, 'AI insights are busy right now, so these were calculated by rules.');
  calls.push(now);

  const model = env.GEMINI_MODEL?.trim() || 'gemini-flash-latest';
  let result: InsightResult;
  try {
    const response = await request(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
        cache: 'no-store',
        signal: AbortSignal.timeout(20000),
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM }] },
          contents: [
            {
              role: 'user',
              parts: [{ text: JSON.stringify({ ...data, rule_based_hints: ruleInsights(data) }) }],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: 'application/json',
            responseSchema: RESPONSE_SCHEMA,
          },
        }),
      },
    );
    if (!response.ok) throw new Error(`Gemini responded ${response.status}`);
    const body = await response.json();
    const text = body?.candidates?.[0]?.content?.parts
      ?.map((p: { text?: string }) => p.text ?? '')
      .join('');
    const parsed = JSON.parse(text ?? '{}');
    const { kept, removed } = groundInsights(
      Array.isArray(parsed.insights) ? parsed.insights.slice(0, 6) : [],
      data,
    );
    result = kept.length
      ? {
          source: 'gemini',
          insights: kept.slice(0, 4),
          note: removed
            ? `${removed} AI suggestion${removed === 1 ? ' was' : 's were'} removed because a number could not be verified.`
            : undefined,
        }
      : fallback(
          data,
          'AI suggestions could not be verified against the data, so these were calculated by rules.',
        );
  } catch (error) {
    console.error(
      'Community needs AI request failed:',
      error instanceof Error ? error.message : error,
    );
    result = fallback(
      data,
      'AI insights are temporarily unavailable, so these were calculated by rules.',
    );
  }
  cache.set(hash, { at: now, result });
  if (cache.size > 50) cache.delete(cache.keys().next().value!);
  return result;
}
