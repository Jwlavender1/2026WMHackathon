import { readFileSync } from 'node:fs';
import type { PoolConfig } from 'pg';
export function connectionOptions(
  connectionString: string,
  env: Record<string, string | undefined> = process.env,
): PoolConfig {
  const url = new URL(connectionString);
  if (!['postgres:', 'postgresql:'].includes(url.protocol))
    throw new Error('Use a PostgreSQL connection URL.');
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  const mode = env.PGSSL_MODE ?? (local ? 'disable' : 'verify-full');
  if (!['disable', 'verify-full'].includes(mode) || (!local && mode === 'disable'))
    throw new Error('Remote PostgreSQL requires verified TLS.');
  // pg's URL SSL options otherwise replace the explicitly configured trust policy.
  for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'uselibpqcompat'])
    url.searchParams.delete(key);
  const ca =
    env.PGSSL_CA?.replace(/\\n/g, '\n') ||
    (env.PGSSL_CA_FILE ? readFileSync(env.PGSSL_CA_FILE, 'utf8') : undefined);
  return {
    connectionString: url.toString(),
    ssl: mode === 'disable' ? false : { rejectUnauthorized: true, ...(ca ? { ca } : {}) },
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    application_name: 'commonly',
  };
}
