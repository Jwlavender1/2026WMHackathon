import { createHmac, timingSafeEqual } from 'node:crypto';
import { locationSchema, US_STATES, type Location, type LocationOption } from './location';

const TTL = 60 * 60 * 1000;
function signature(value: string, actor: string, secret: string) {
  return createHmac('sha256', secret)
    .update(`turnout-location-v1\0${actor}\0${value}`)
    .digest('base64url');
}
export function signLocation(
  location: Location,
  actor: string,
  secret: string,
  now = Date.now(),
): string {
  if (!secret) throw new Error('Location verification is not configured.');
  const value = Buffer.from(
    JSON.stringify({ location: locationSchema.parse(location), expires: now + TTL }),
  ).toString('base64url');
  return `${value}.${signature(value, actor, secret)}`;
}
export function verifyLocation(
  token: string,
  id: string,
  actor: string,
  secret: string,
  now = Date.now(),
): Location {
  const message = 'Select your city again to confirm its location.';
  if (!secret || token.length > 4096) throw new Error(message);
  const parts = token.split('.');
  if (parts.length !== 2) throw new Error(message);
  const expected = Buffer.from(signature(parts[0], actor, secret));
  const actual = Buffer.from(parts[1]);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    throw new Error(message);
  try {
    const data = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    const place = locationSchema.parse(data.location);
    if (
      place.provider !== 'geoapify' ||
      place.id !== id ||
      !Number.isFinite(data.expires) ||
      data.expires <= now
    )
      throw new Error(message);
    return place;
  } catch {
    throw new Error(message);
  }
}
export function parseCity(result: Record<string, unknown>): Location | null {
  if (result.result_type !== 'city' || String(result.country_code).toUpperCase() !== 'US')
    return null;
  const state =
    String(result.state_code ?? '')
      .replace(/^US-/, '')
      .toUpperCase() || Object.keys(US_STATES).find((code) => US_STATES[code] === result.state);
  const parsed = locationSchema.safeParse({
    id: result.place_id,
    provider: 'geoapify',
    city: result.city ?? result.name,
    state_code: state,
    country_code: 'US',
    latitude: result.lat,
    longitude: result.lon,
  });
  return parsed.success ? parsed.data : null;
}
export async function searchCities(
  query: string,
  actor: string,
  env: Record<string, string | undefined> = process.env,
  request = fetch,
): Promise<LocationOption[]> {
  if (!env.GEOAPIFY_API_KEY || !env.AUTH0_SECRET)
    throw new Error('City lookup is not configured yet. Please try again later.');
  const url = new URL('https://api.geoapify.com/v1/geocode/autocomplete');
  url.search = new URLSearchParams({
    text: query,
    type: 'city',
    filter: 'countrycode:us',
    format: 'json',
    limit: '6',
    apiKey: env.GEOAPIFY_API_KEY,
  }).toString();
  let response: Response;
  try {
    response = await request(url, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
  } catch {
    throw new Error('City lookup is temporarily unavailable. Please try again.');
  }
  if (!response.ok) throw new Error('City lookup is temporarily unavailable. Please try again.');
  const data = await response.json();
  const results: Record<string, unknown>[] = Array.isArray(data.results) ? data.results : [];
  const seen = new Set<string>();
  return results.flatMap((result) => {
    const location = parseCity(result);
    if (!location || seen.has(location.id)) return [];
    seen.add(location.id);
    return [{ location, token: signLocation(location, actor, env.AUTH0_SECRET!) }];
  });
}
