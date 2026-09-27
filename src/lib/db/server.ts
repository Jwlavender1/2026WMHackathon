import 'server-only';
import { Pool, type PoolClient } from 'pg';
import { auth0 } from '@/lib/auth0';
import { appMode } from '@/lib/config';
import { connectionOptions } from './connection';
import { transaction } from './transaction';
const globalDb = globalThis as typeof globalThis & { commonlyPool?: Pool };
function pool() {
  if (!process.env.DATABASE_URL) throw new Error('Live mode needs DATABASE_URL.');
  if (!globalDb.commonlyPool) {
    globalDb.commonlyPool = new Pool(connectionOptions(process.env.DATABASE_URL));
    globalDb.commonlyPool.on('error', () =>
      console.error('An idle PostgreSQL connection was lost. A later request will reconnect.'),
    );
  }
  return globalDb.commonlyPool;
}
export async function databaseReady() {
  const result = await pool().query<{ ready: boolean }>(
    "SELECT to_regprocedure('public.app_snapshot()') IS NOT NULL AND to_regprocedure('public.app_delete_account(text)') IS NOT NULL AND to_regprocedure('public.app_delete_event(uuid,boolean)') IS NOT NULL AND to_regprocedure('public.app_resolve_user(text,text,bigint)') IS NOT NULL AS ready",
  );
  if (!result.rows[0].ready) throw new Error('Database migrations are required.');
}
export async function withDatabaseUser<T>(
  operation: (
    client: PoolClient,
    actor: string | null,
    displayName: string,
    identity: { subject: string | null; email?: string },
  ) => Promise<T>,
  required = false,
): Promise<T> {
  if (appMode() !== 'live') throw new Error('This operation requires live mode.');
  const session = await auth0().getSession();
  if (required && !session?.user?.sub) throw new Error('Sign in to continue.');
  const displayName = String(session?.user?.name ?? 'Community member');
  return transaction(
    await pool().connect(),
    async (client) => {
      if (!session?.user?.sub) return null;
      const result = await client.query<{ id: string | null }>(
        'SELECT public.app_resolve_user($1,$2,$3::bigint) AS id',
        [session.user.sub, displayName, session.internal.createdAt],
      );
      return result.rows[0].id;
    },
    (client, actor) => {
      if (required && !actor)
        throw new Error(
          'This Turnout account was deleted. Sign out before creating a new account.',
        );
      return operation(client, actor, displayName, {
        subject: session?.user.sub ?? null,
        email: typeof session?.user.email === 'string' ? session.user.email : undefined,
      });
    },
  );
}
