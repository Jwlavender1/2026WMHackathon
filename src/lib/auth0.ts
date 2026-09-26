import 'server-only';
import { Auth0Client } from '@auth0/nextjs-auth0/server';
import { authConfiguration } from './config';
let client: Auth0Client | undefined;
export function auth0() {
  client ??= new Auth0Client({
    ...authConfiguration(),
    enableAccessTokenEndpoint: false,
    signInReturnToPath: '/onboarding',
  });
  return client;
}
