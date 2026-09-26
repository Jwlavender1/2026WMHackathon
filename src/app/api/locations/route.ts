import { auth0 } from '@/lib/auth0';
import { appMode } from '@/lib/config';
import { searchCities } from '@/lib/geocoding';
import { demoLocations } from '@/lib/location';

export const dynamic = 'force-dynamic';
const requests = new Map<string, { count: number; expires: number }>();
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get('q')?.trim() ?? '';
  const reply = (body: unknown, status = 200) =>
    Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
  if (query.length < 3 || query.length > 100)
    return reply({ error: 'Enter 3–100 characters to search for a city.' }, 400);
  if (appMode() === 'demo')
    return reply({
      suggestions: demoLocations(query).map((location) => ({ location, token: '' })),
    });
  try {
    const session = await auth0().getSession();
    if (!session?.user.sub) return reply({ error: 'Sign in to choose your location.' }, 401);
    const now = Date.now();
    for (const [key, value] of requests) if (value.expires <= now) requests.delete(key);
    const quota = requests.get(session.user.sub) ?? { count: 0, expires: now + 60000 };
    if (quota.count >= 60 || (!requests.has(session.user.sub) && requests.size >= 5000))
      return reply({ error: 'Please wait a minute before searching again.' }, 429);
    quota.count++;
    requests.set(session.user.sub, quota);
    return reply({ suggestions: await searchCities(query, session.user.sub) });
  } catch (error) {
    return reply(
      {
        error:
          error instanceof Error && /^City lookup/.test(error.message)
            ? error.message
            : 'City lookup is temporarily unavailable. Please try again.',
      },
      503,
    );
  }
}
