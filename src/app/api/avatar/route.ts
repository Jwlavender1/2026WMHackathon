import { withDatabaseUser } from '@/lib/db/server';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const image = await withDatabaseUser(async (client, actor) => {
      const result = await client.query<{ content: Buffer; mime_type: string }>(
        'SELECT content,mime_type FROM public.profile_images WHERE user_id=$1',
        [actor],
      );
      return result.rows[0];
    }, true);
    if (!image) return new Response(null, { status: 404 });
    return new Response(new Uint8Array(image.content), {
      headers: {
        'Content-Type': image.mime_type,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return new Response(null, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }
}
