import { appMode, authConfiguration } from '@/lib/config';
import { databaseReady } from '@/lib/db/server';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    if (appMode() === 'live') {
      authConfiguration();
      await databaseReady();
    }
    return Response.json(
      { status: 'ok', mode: appMode() },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return Response.json({ status: 'configuration-required' }, { status: 503 });
  }
}
