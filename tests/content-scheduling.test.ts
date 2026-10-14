import { describe, expect, it } from 'vitest';
import {
  boardWeekday,
  contentStatus,
  isContentActive,
  orderContent,
  paginate,
  programmeHasEnded,
  programmeOccursToday,
  resolveJanazahExpiry,
  weightedContent,
} from '../lib/content-scheduling';
import {
  type ContentItem,
  type Programme,
} from '../lib/masjid-types';

const baseProgramme: Programme = {
  id: 1,
  title: 'PROGRAMME',
  subtitle: '',
  category: 'PROGRAMME',
  imageUrl: '',
  description: '',
  dateText: '',
  startTime: '',
  endTime: '',
  venue: '',
  audience: '',
  speaker: '',
  quote: '',
  quoteSource: '',
  eventStart: '',
  eventEnd: '',
  displayFrom: '',
  displayUntil: '',
  active: true,
  showUpcoming: true,
  featured: false,
  sortOrder: 0,
  recurringWeekdays: [],
  priority: 'NORMAL',
  displayDuration: 12,
  archived: false,
};

const item = (overrides: Partial<ContentItem> = {}): ContentItem => ({
  id: 1,
  type: 'GENERAL_NOTICE',
  displayProfile: 'MAIN',
  zone: 'IMPORTANT',
  title: 'Notice',
  subtitle: '',
  body: '',
  imageUrl: '',
  icon: 'megaphone',
  qrUrl: '',
  details: {},
  enabled: true,
  archived: false,
  sortOrder: 0,
  displayDuration: 10,
  startAt: '',
  endAt: '',
  recurringWeekdays: [],
  priority: 'NORMAL',
  takeover: false,
  createdAt: '',
  updatedAt: '',
  ...overrides,
});

describe('smart scheduling', () => {
  const now = new Date('2026-09-08T10:00:00+02:00');
  it('uses the Africa/Johannesburg weekday', () =>
    expect(boardWeekday(now)).toBe(2));
  it('supports scheduled and expired states', () => {
    expect(contentStatus(item({ startAt: '2026-09-09T09:00' }), now)).toBe(
      'Scheduled',
    );
    expect(contentStatus(item({ endAt: '2026-09-07T09:00' }), now)).toBe(
      'Expired',
    );
    expect(contentStatus(item(), now)).toBe('Active');
  });
  it('applies weekday recurrence', () => {
    expect(isContentActive(item({ recurringWeekdays: [2] }), now)).toBe(true);
    expect(isContentActive(item({ recurringWeekdays: [3] }), now)).toBe(false);
  });
  it('automatically expires Janazah content six hours after burial', () => {
    const expiry = resolveJanazahExpiry(
      item({
        type: 'JANAZAH',
        details: { burialDateTime: '2026-09-08T12:00' },
      }),
    );
    expect(expiry?.toISOString()).toBe('2026-09-08T16:00:00.000Z');
    expect(
      isContentActive(
        item({
          type: 'JANAZAH',
          details: { burialDateTime: '2026-09-08T08:00' },
        }),
        now,
      ),
    ).toBe(true);
  });
  it('sorts and weights priorities without removing normal content', () => {
    const ordered = orderContent([
      item({ id: 1 }),
      item({ id: 2, priority: 'URGENT' }),
      item({ id: 3, priority: 'IMPORTANT' }),
    ]);
    expect(ordered.map((entry) => entry.id)).toEqual([2, 3, 1]);
    expect(weightedContent(ordered).map((entry) => entry.id)).toEqual([
      2, 2, 2, 3, 3, 1,
    ]);
  });
  it('paginates upcoming programmes four at a time', () =>
    expect(paginate([1, 2, 3, 4, 5, 6, 7, 8, 9], 4)).toEqual([
      [1, 2, 3, 4],
      [5, 6, 7, 8],
      [9],
    ]));
  it('promotes one-off programmes on the event day and expires them afterward', () => {
    const programme = {
      ...baseProgramme,
      eventStart: '2026-09-09T20:00',
      eventEnd: '2026-09-09T22:00',
    };
    expect(
      programmeOccursToday(programme, new Date('2026-09-09T10:00:00+02:00')),
    ).toBe(true);
    expect(
      programmeHasEnded(programme, new Date('2026-09-09T21:00:00+02:00')),
    ).toBe(false);
    expect(
      programmeHasEnded(programme, new Date('2026-09-09T22:01:00+02:00')),
    ).toBe(true);
  });
  it('expires an event without an end time after its Johannesburg calendar day', () => {
    const programme = {
      ...baseProgramme,
      eventStart: '2026-09-09T20:00',
      eventEnd: '',
    };
    expect(
      programmeHasEnded(programme, new Date('2026-09-09T23:59:00+02:00')),
    ).toBe(false);
    expect(
      programmeHasEnded(programme, new Date('2026-09-10T00:01:00+02:00')),
    ).toBe(true);
  });
});
