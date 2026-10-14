import { NextResponse } from 'next/server';
import { readState } from '@/lib/server-data';
import { refreshJamiatDateIfDue } from '@/lib/server-islamic-date';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    let state = await readState(false, true);
    if (await refreshJamiatDateIfDue(state)) state = await readState(false, true);
    return NextResponse.json(state, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    // Do not report a blank fallback board as a healthy database after an upgrade.
    return NextResponse.json({ error: 'Board data is temporarily unavailable.' }, {
      status: 503, headers: { 'Cache-Control': 'no-store' },
    });
  }
}
