import { NextResponse } from 'next/server';
import { logout } from '@/lib/server-auth';
import { assertSameOrigin, requestErrorResponse } from '@/lib/request-security';

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await logout();
    return NextResponse.json(
      { ok: true },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return requestErrorResponse(error);
  }
}
