import { NextResponse } from 'next/server';
import { currentUser, isAuthenticated } from '@/lib/server-auth';
import { hashPassword } from '@/lib/password';
import {
  deleteAnnouncement,
  deleteContentItem,
  deleteHadith,
  deleteMedia,
  deleteProgramme,
  deleteUser,
  readState,
  renameMedia,
  saveAnnouncement,
  saveContentItem,
  saveDonation,
  saveHadith,
  saveProgramme,
  saveSettings,
  saveUser,
  writeAudit,
} from '@/lib/server-data';
import type {
  Announcement,
  ContentItem,
  DonationSettings,
  HadithEntry,
  Programme,
  Settings,
} from '@/lib/masjid-types';
import { canManage, validateContentItem } from '@/lib/content-validation';
import { isValidTimeZone } from '@/lib/timezone';

export const dynamic = 'force-dynamic';

const unauthorized = () =>
  NextResponse.json({ error: 'Sign in required.' }, { status: 401 });

type HadithPayload = Omit<HadithEntry, 'id'> & { id?: number };

export async function GET() {
  if (!(await isAuthenticated())) return unauthorized();
  return NextResponse.json(await readState(true, true), {
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function POST(request: Request) {
  if (!(await isAuthenticated())) return unauthorized();
  try {
    const body = (await request.json()) as {
      entity: string;
      action: string;
      payload?: unknown;
      id?: number;
    };
    const actor = await currentUser();
    if (!actor || !actor.active) return unauthorized();
    if (!canManage(body.entity, actor.role))
      return NextResponse.json(
        { error: 'Administrator permission is required.' },
        { status: 403 },
      );
    if (body.entity === 'settings' && body.action === 'save') {
      const settings = body.payload as Settings;
      if (!isValidTimeZone(settings?.timezone))
        return NextResponse.json({ error: 'Choose a valid timezone, for example Africa/Johannesburg.' }, { status: 400 });
      settings.islamicDateManual = settings.islamicDateManual?.trim() ?? '';
      if (!['JAMIAT', 'MANUAL'].includes(settings.islamicDateSource))
        return NextResponse.json(
          { error: 'Choose a valid Islamic date source.' },
          { status: 400 },
        );
      if (
        settings.islamicDateSource === 'MANUAL' &&
        !settings.islamicDateManual
      )
        return NextResponse.json(
          { error: 'Enter the manual Islamic date.' },
          { status: 400 },
        );
      if (settings.islamicDateManual.length > 80)
        return NextResponse.json(
          { error: 'The manual Islamic date is too long.' },
          { status: 400 },
        );
      await saveSettings(settings);
    } else if (body.entity === 'donation' && body.action === 'save')
      await saveDonation(body.payload as DonationSettings);
    else if (body.entity === 'programme' && body.action === 'save')
      await saveProgramme(body.payload as Programme);
    else if (body.entity === 'programme' && body.action === 'delete' && body.id)
      await deleteProgramme(body.id);
    else if (body.entity === 'announcement' && body.action === 'save')
      await saveAnnouncement(body.payload as Announcement);
    else if (
      body.entity === 'announcement' &&
      body.action === 'delete' &&
      body.id
    )
      await deleteAnnouncement(body.id);
    else if (body.entity === 'media' && body.action === 'delete' && body.id)
      await deleteMedia(body.id);
    else if (body.entity === 'media' && body.action === 'rename') {
      const input = body.payload as { id?: number; filename?: string };
      if (!input?.id || !input?.filename?.trim())
        return NextResponse.json(
          { error: 'A filename is required.' },
          { status: 400 },
        );
      await renameMedia(input.id, input.filename);
    }
    else if (body.entity === 'content' && body.action === 'save') {
      const item = body.payload as ContentItem;
      const errors = validateContentItem(item);
      if (errors.length)
        return NextResponse.json({ error: errors.join(' ') }, { status: 400 });
      await saveContentItem(item);
    }     else if (body.entity === 'content' && body.action === 'delete' && body.id)
      await deleteContentItem(body.id);
    else if (body.entity === 'hadith' && body.action === 'save')
      await saveHadith(body.payload as HadithPayload);
    else if (body.entity === 'hadith' && body.action === 'delete' && body.id)
      await deleteHadith(body.id);
    else if (body.entity === 'user' && body.action === 'save') {
      const input = body.payload as {
        id?: number;
        username: string;
        password?: string;
        role: 'admin' | 'editor';
        active: boolean;
      };
      await saveUser({
        ...input,
        passwordHash: input.password
          ? await hashPassword(input.password)
          : undefined,
      });
    } else if (body.entity === 'user' && body.action === 'delete' && body.id)
      await deleteUser(body.id, actor.username);
    else
      return NextResponse.json(
        { error: 'Unsupported action.' },
        { status: 400 },
      );
    await writeAudit(
      actor.username,
      body.action,
      body.entity,
      body.id ?? ((body.payload as { id?: number } | undefined)?.id || null),
      `${body.entity} ${body.action}`,
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'The change could not be saved.',
      },
      { status: 500 },
    );
  }
}
