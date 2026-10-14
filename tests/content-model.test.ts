import { describe, expect, it } from 'vitest';
import {
  canManage,
  duplicateContentItem,
  validateContentItem,
} from '../lib/content-validation';
import { nextCarouselIndex } from '../lib/carousel';
import {
  defaultDisplayProfileFor,
  type ContentItem,
} from '../lib/masjid-types';

const base: ContentItem = {
  id: 8,
  type: 'JANAZAH',
  displayProfile: 'COMMUNITY',
  zone: 'JANAZAH',
  title: 'Janazah announcement',
  subtitle: '',
  body: 'Please make dua.',
  imageUrl: '',
  icon: 'megaphone',
  qrUrl: '',
  details: { deceasedName: 'Test Name', janazahDateTime: '2026-09-08T15:00' },
  enabled: true,
  archived: false,
  sortOrder: 2,
  displayDuration: 15,
  startAt: '',
  endAt: '',
  recurringWeekdays: [],
  priority: 'URGENT',
  takeover: false,
  createdAt: '',
  updatedAt: '',
};

describe('content lifecycle', () => {
  it('validates structured Janazah, Nikah and Sick/Dua requirements', () => {
    expect(validateContentItem(base)).toEqual([]);
    expect(validateContentItem({ ...base, details: {} })).toContain(
      'The deceased name is required.',
    );
    expect(
      validateContentItem({
        ...base,
        type: 'NIKAH',
        details: {},
        subtitle: '',
      }),
    ).toContain('Nikah wording or a groom name is required.');
    expect(
      validateContentItem({ ...base, type: 'SICK_DUA', details: {} }),
    ).toContain("The person's name is required.");
  });
  it('validates poster media and WhatsApp invite configuration', () => {
    expect(
      validateContentItem({
        ...base,
        type: 'EXTERNAL_POSTER',
        zone: 'COMMUNITY_POSTERS',
        imageUrl: '',
        details: {},
      }),
    ).toContain('A poster file is required.');
    expect(
      validateContentItem({
        ...base,
        type: 'WHATSAPP_QR',
        zone: 'WHATSAPP_QR',
        qrUrl: '',
        details: {},
      }),
    ).toContain('A WhatsApp invite URL is required.');
    expect(
      validateContentItem({
        ...base,
        type: 'LADIES_TALEEM',
        zone: 'LADIES_TALEEM',
        title: '',
        details: {},
      }),
    ).toContain('A title is required.');
  });
  it('duplicates safely as a disabled draft and preserves its zone', () => {
    const copy = duplicateContentItem(base);
    expect(copy).toMatchObject({
      id: 0,
      displayProfile: 'COMMUNITY',
      zone: 'JANAZAH',
      enabled: false,
      title: 'Janazah announcement (copy)',
    });
  });
  it('uses the requested default display targeting', () => {
    expect(defaultDisplayProfileFor('JANAZAH')).toBe('COMMUNITY');
    expect(defaultDisplayProfileFor('NIKAH')).toBe('COMMUNITY');
    expect(defaultDisplayProfileFor('SICK_DUA')).toBe('COMMUNITY');
    expect(defaultDisplayProfileFor('LADIES_TALEEM')).toBe('COMMUNITY');
    expect(defaultDisplayProfileFor('EXTERNAL_POSTER')).toBe('COMMUNITY');
    expect(defaultDisplayProfileFor('WHATSAPP_QR')).toBe('MAIN');
    expect(defaultDisplayProfileFor('GENERAL_NOTICE')).toBe('MAIN');
    expect(defaultDisplayProfileFor('DONATION')).toBe('MAIN');
  });
  it('enforces user-management permissions', () => {
    expect(canManage('content', 'editor')).toBe(true);
    expect(canManage('user', 'editor')).toBe(false);
    expect(canManage('user', 'admin')).toBe(true);
  });
  it('rotates independent indices without cross-zone state', () => {
    const main = nextCarouselIndex(0, 3);
    const important = nextCarouselIndex(2, 4);
    expect(main).toBe(1);
    expect(important).toBe(3);
    expect(nextCarouselIndex(main, 3)).toBe(2);
    expect(nextCarouselIndex(3, 4)).toBe(0);
  });
});
