import { NextResponse } from 'next/server';
import { login } from '@/lib/server-auth';
import {
  assertSameOrigin,
  readJsonBody,
  RequestError,
  requestErrorResponse,
} from '@/lib/request-security';

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const body = (await readJsonBody(request, 8192)) as {
      username?: string;
      password?: string;
    } | null;
    const secure = new URL(request.url).protocol === 'https:';
    if (
      !body?.username ||
      !body.password ||
      !(await login(body.username, body.password, secure))
    )
      return NextResponse.json(
        { error: 'Incorrect username or password.' },
        { status: 401 },
      );
    return NextResponse.json(
      { ok: true },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    if (error instanceof RequestError) return requestErrorResponse(error);
    console.error('Admin login failed', error);
    return NextResponse.json(
      { error: 'Login service is temporarily unavailable.' },
      { status: 503 },
    );
  }
}
