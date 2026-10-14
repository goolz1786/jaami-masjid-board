import { env } from 'cloudflare:workers';
import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/server-auth';
import { addMedia } from '@/lib/server-data';

const ALLOWED = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);
const MAX_BYTES = 20 * 1024 * 1024;

export async function POST(request: Request) {
  if (!(await isAuthenticated()))
    return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  const data = await request.formData();
  const file = data.get('file');
  if (!(file instanceof File))
    return NextResponse.json({ error: 'Choose a file.' }, { status: 400 });
  if (!ALLOWED.has(file.type))
    return NextResponse.json(
      { error: 'Use a JPG, JPEG, PNG, WEBP or PDF file.' },
      { status: 400 },
    );
  if (file.size > MAX_BYTES)
    return NextResponse.json(
      { error: 'Files must be 20 MB or smaller.' },
      { status: 400 },
    );
  const extension =
    file.type === 'image/png'
      ? 'png'
      : file.type === 'image/webp'
        ? 'webp'
        : file.type === 'application/pdf'
          ? 'pdf'
          : 'jpg';
  const key = `media/${crypto.randomUUID()}.${extension}`;
  await env.FILES.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
  });
  await addMedia(key, file.name, file.type, file.size);
  return NextResponse.json({
    ok: true,
    url: `/api/media/${encodeURIComponent(key)}`,
  });
}
