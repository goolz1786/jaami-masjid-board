import { env } from 'cloudflare:workers';
import { isAuthenticated } from '@/lib/server-auth';
import { readState } from '@/lib/server-data';
import { publicMediaKeys } from '@/lib/public-state';

export async function GET(
  _request: Request,
  context: { params: Promise<{ key: string[] }> },
) {
  const { key } = await context.params;
  const objectKey = key.join('/');
  if (!objectKey.startsWith('media/'))
    return new Response('Not found', { status: 404 });
  try {
    if (
      !(await isAuthenticated()) &&
      !publicMediaKeys(
        await readState(false, true),
        new URL(_request.url).origin,
      ).has(objectKey)
    )
      return new Response('Not found', {
        status: 404,
        headers: { 'Cache-Control': 'no-store' },
      });
  } catch {
    return new Response('Media temporarily unavailable', {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
  const object = await env.FILES.get(objectKey);
  if (!object) return new Response('Not found', { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('x-content-type-options', 'nosniff');
  headers.set('cache-control', 'private, no-store');
  headers.set('content-security-policy', "sandbox; default-src 'none'");
  const type = headers.get('content-type');
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(type ?? '')) {
    headers.set('content-disposition', 'attachment');
    if (type !== 'application/pdf')
      headers.set('content-type', 'application/octet-stream');
  }
  return new Response(object.body, { headers });
}
