import { NextResponse, type NextRequest } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { appMode } from '@/lib/config';
export async function proxy(request: NextRequest) {
  if (appMode() === 'demo' || request.nextUrl.pathname === '/api/health')
    return NextResponse.next({ request });
  return auth0().middleware(request);
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|images/).*)'] };
