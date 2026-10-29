import { describe, expect, it } from 'vitest';
import {
  buildContentPreview,
  contentVisibleOnBoard,
} from '../lib/board-preview';
import { defaultDisplayState, type ContentItem } from '../lib/masjid-types';

const now = new Date('2026-10-16T10:00:00Z');
const poster = (id: number, extra: Partial<ContentItem> = {}): ContentItem => ({
  id,
  type: 'EXTERNAL_POSTER',
  displayProfile: 'COMMUNITY',
  zone: 'COMMUNITY_POSTERS',
  title: 'Community poster',
  subtitle: '',
  body: '',
  imageUrl: '/api/media/media%2Fposter.pdf',
  icon: 'megaphone',
  qrUrl: '',
  details: { posterMimeType: 'application/pdf' },
  enabled: true,
  archived: false,
  sortOrder: 10,
  displayDuration: 12,
  startAt: '',
  endAt: '',
  recurringWeekdays: [],
  priority: 'NORMAL',
  takeover: false,
  createdAt: '',
  updatedAt: '',
  ...extra,
});

describe('read-only board previews', () => {
  it('replaces the saved item with the unsaved form without mutating either', () => {
    const saved = poster(7, { title: 'Saved title' });
    const state = structuredClone({
      ...defaultDisplayState,
      contentItems: [saved],
    });
    const draft = poster(7, {
      title: 'Unsaved title',
      enabled: false,
      archived: true,
    });
    const before = structuredClone({ state, draft });
    const preview = buildContentPreview(state, draft, now);
    expect(preview.profile).toBe('COMMUNITY');
    expect(preview.state.contentItems.map((item) => item.title)).toEqual([
      'Unsaved title',
    ]);
    expect(preview.item.enabled).toBe(false);
    expect(preview.item.archived).toBe(true);
    expect({ state, draft }).toEqual(before);
  });

  it('keeps other unpublished notices and admin-only data out of the snapshot', () => {
    const selected = poster(0, {
      enabled: false,
      details: { notes: 'Private notes' },
    });
    const state = {
      ...structuredClone(defaultDisplayState),
      contentItems: [
        poster(1),
        poster(2, { enabled: false }),
        poster(3, { startAt: '2030-01-01T10:00' }),
      ],
      users: [
        {
          id: 1,
          username: 'admin',
          role: 'admin' as const,
          active: true,
          createdAt: '',
          root: true,
        },
      ],
      media: [
        {
          id: 1,
          key: 'private',
          filename: 'Private media',
          mimeType: 'image/png',
          size: 1,
          url: '/private',
          createdAt: '',
        },
      ],
    };
    const preview = buildContentPreview(state, selected, now);
    expect(preview.state.contentItems.map((item) => item.id)).toEqual([1, 0]);
    expect(preview.state.users).toEqual([]);
    expect(preview.state.media).toEqual([]);
    expect(preview.state.auditLog).toEqual([]);
    expect(preview.item.details).not.toHaveProperty('notes');
  });

  it('shows only the selected expired or disabled item outside its schedule', () => {
    const expired = poster(8, {
      enabled: false,
      archived: true,
      endAt: '2020-01-01T10:00',
    });
    expect(contentVisibleOnBoard(expired, now)).toBe(false);
    expect(contentVisibleOnBoard(expired, now, 8)).toBe(true);
    expect(contentVisibleOnBoard(expired, now, 9)).toBe(false);
    expect(contentVisibleOnBoard(poster(9), now)).toBe(true);
  });

  it('previews a new unsaved Janazah without changing the actual event dates', () => {
    const draft = poster(0, {
      type: 'JANAZAH',
      zone: 'JANAZAH',
      details: { burialDateTime: '2020-01-01T12:00' },
    });
    const preview = buildContentPreview(defaultDisplayState, draft, now);
    expect(preview.item.details.burialDateTime).toBe('2020-01-01T12:00');
    expect(contentVisibleOnBoard(preview.item, now, preview.item.id)).toBe(
      true,
    );
    expect(contentVisibleOnBoard(preview.item, now)).toBe(false);
  });

  it('uses the selected main-board profile and retains surrounding published content', () => {
    const draft = poster(5, {
      displayProfile: 'MAIN',
      type: 'GENERAL_NOTICE',
      zone: 'MAIN_FEATURE',
    });
    const state = { ...defaultDisplayState, contentItems: [poster(1)] };
    const preview = buildContentPreview(state, draft, now);
    expect(preview.profile).toBe('MAIN');
    expect(preview.state.contentItems.map((item) => item.id)).toEqual([1, 5]);
    expect(preview.item.imageUrl).toBe('/api/media/media%2Fposter.pdf');
  });

  it('rejects a display profile that has no TV layout', () => {
    expect(() =>
      buildContentPreview(
        defaultDisplayState,
        poster(4, { displayProfile: 'HALL' }),
        now,
      ),
    ).toThrow('Main or Community');
  });

  it.each([
    {
      displayProfile: 'MAIN',
      zone: 'COMMUNITY_POSTERS',
      type: 'EXTERNAL_POSTER',
    },
    { displayProfile: 'COMMUNITY', zone: 'IMPORTANT', type: 'GENERAL_NOTICE' },
    { displayProfile: 'MAIN', zone: 'LIBRARY', type: 'LIBRARY' },
  ] as const)(
    'explains a missing TV slot instead of showing an empty preview (%s)',
    (configuration) => {
      expect(() =>
        buildContentPreview(defaultDisplayState, poster(4, configuration), now),
      ).toThrow('not shown');
    },
  );

  it('can preview a full-board takeover even without a normal panel slot', () => {
    const draft = poster(4, { displayProfile: 'MAIN', takeover: true });
    expect(
      buildContentPreview(defaultDisplayState, draft, now).item.takeover,
    ).toBe(true);
  });
});
