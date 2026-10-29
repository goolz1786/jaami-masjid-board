import { env } from 'cloudflare:workers';

export async function GET(_request: Request, context: { params: Promise<{ key: string[] }> }) {
  const { key } = await context.params;
  const objectKey = key.join('/');
  if (!objectKey.startsWith('media/')) return new Response('Not found', { status: 404 });
  const object = await env.FILES.get(objectKey);
  if (!object) return new Response('Not found', { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('x-content-type-options', 'nosniff');
  headers.set('cache-control', 'public, max-age=31536000, immutable');
  return new Response(object.body, { headers });
}
