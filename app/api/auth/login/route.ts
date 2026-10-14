import { NextResponse } from 'next/server';
import { login } from '@/lib/server-auth';

export async function POST(request: Request) {
  try {
    const body = await request.json() as { username?: string; password?: string };
    const secure = new URL(request.url).protocol === 'https:';
    if (!body.username || !body.password || !(await login(body.username, body.password, secure))) return NextResponse.json({ error: 'Incorrect username or password.' }, { status: 401 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Admin login failed', error);
    return NextResponse.json(
      { error: 'Login service is temporarily unavailable.' },
      { status: 503 },
    );
  }
}
