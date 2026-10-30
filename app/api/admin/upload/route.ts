import { env } from 'cloudflare:workers';
import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/server-auth';
import { addMedia } from '@/lib/server-data';
import {
  assertSameOrigin,
  readLimitedBody,
  RequestError,
  requestErrorResponse,
} from '@/lib/request-security';

const ALLOWED = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);
const MAX_BYTES = 20 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    if (!(await isAuthenticated()))
      return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
    if (
      !request.headers
        .get('content-type')
        ?.toLowerCase()
        .startsWith('multipart/form-data;')
    )
      throw new RequestError(415, 'Use multipart/form-data.');
    const bytesBody = await readLimitedBody(request, MAX_BYTES + 64 * 1024);
    let data: FormData;
    try {
      data = await new Response(bytesBody, {
        headers: { 'content-type': request.headers.get('content-type')! },
      }).formData();
    } catch {
      throw new RequestError(400, 'Invalid multipart upload.');
    }
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
    const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    const startsWith = (signature: number[]) =>
      signature.every((value, index) => bytes[index] === value);
    const matchesType =
      (file.type === 'image/png' &&
        startsWith([137, 80, 78, 71, 13, 10, 26, 10])) ||
      (file.type === 'image/jpeg' && startsWith([255, 216, 255])) ||
      (file.type === 'image/webp' &&
        startsWith([82, 73, 70, 70]) &&
        bytes.length >= 12 &&
        bytes[8] === 87 &&
        bytes[9] === 69 &&
        bytes[10] === 66 &&
        bytes[11] === 80) ||
      (file.type === 'application/pdf' && startsWith([37, 80, 68, 70, 45]));
    if (!matchesType)
      return NextResponse.json(
        { error: 'The file contents do not match its type.' },
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
  } catch (error) {
    return requestErrorResponse(error, 'The file could not be uploaded.');
  }
}
