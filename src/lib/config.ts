export function appMode(env: Record<string, string | undefined> = process.env): 'demo' | 'live' {
  const mode = env.APP_MODE ?? 'demo';
  if (mode !== 'demo' && mode !== 'live') throw new Error('APP_MODE must be demo or live.');
  return mode;
}
export function authConfiguration(env: Record<string, string | undefined> = process.env) {
  const names = [
    'AUTH0_DOMAIN',
    'AUTH0_CLIENT_ID',
    'AUTH0_CLIENT_SECRET',
    'AUTH0_SECRET',
    'APP_BASE_URL',
  ] as const;
  const missing = names.filter((name) => !env[name]?.trim());
  if (missing.length) throw new Error(`Live authentication needs: ${missing.join(', ')}.`);
  if (!/^[a-fA-F0-9]{64}$/.test(env.AUTH0_SECRET!))
    throw new Error('AUTH0_SECRET must be a random 32-byte hex value.');
  const origin = new URL(env.APP_BASE_URL!);
  if (
    origin.protocol !== 'https:' &&
    !(origin.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(origin.hostname))
  )
    throw new Error('APP_BASE_URL must use HTTPS except on localhost.');
  if (origin.origin !== env.APP_BASE_URL!.replace(/\/$/, ''))
    throw new Error('APP_BASE_URL must be a single origin without a path.');
  if (!/^[a-zA-Z0-9.-]+$/.test(env.AUTH0_DOMAIN!))
    throw new Error('AUTH0_DOMAIN must be a hostname without a scheme or path.');
  return {
    domain: env.AUTH0_DOMAIN!,
    clientId: env.AUTH0_CLIENT_ID!,
    clientSecret: env.AUTH0_CLIENT_SECRET!,
    secret: env.AUTH0_SECRET!,
    appBaseUrl: origin.origin,
  };
}
