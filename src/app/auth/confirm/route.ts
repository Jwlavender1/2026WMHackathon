import { NextResponse, type NextRequest } from 'next/server';
import { serverClient } from '@/lib/supabase/server';
export async function GET(request: NextRequest) {
  const client = await serverClient();
  const params = request.nextUrl.searchParams;
  const token = params.get('token_hash');
  const code = params.get('code');
  const result = token
    ? await client.auth.verifyOtp({ token_hash: token, type: 'email' })
    : code
      ? await client.auth.exchangeCodeForSession(code)
      : null;
  return NextResponse.redirect(
    new URL(result && !result.error ? '/profile' : '/sign-in?error=confirmation', request.url),
  );
}
