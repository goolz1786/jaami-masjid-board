import { describe, expect, it } from 'vitest';
import {
  buildPosterPages,
  posterLayoutClass,
  shouldRotatePosterPages,
} from '../lib/community-posters';
import type { ContentItem } from '../lib/masjid-types';

const poster = (id: number): ContentItem => ({
  id,
  type: 'EXTERNAL_POSTER',
  displayProfile: 'COMMUNITY',
  zone: 'COMMUNITY_POSTERS',
  title: `Poster ${id}`,
  subtitle: '',
  body: '',
  imageUrl: `/poster-${id}.png`,
  icon: 'megaphone',
  qrUrl: '',
  details: { organisationName: 'Community organisation' },
  enabled: true,
  archived: false,
  sortOrder: id,
  displayDuration: 18,
  startAt: '',
  endAt: '',
  recurringWeekdays: [],
  priority: 'NORMAL',
  takeover: false,
  createdAt: '',
  updatedAt: '',
});

describe('community poster wall', () => {
  it.each([1, 2, 3, 4, 5, 6])(
    'uses the dedicated %i-poster layout class',
    (count) => {
      expect(posterLayoutClass(count)).toBe(`poster-count-${count}`);
    },
  );

  it.each([1, 2, 3, 4, 5])(
    'shows one poster per slide so each is readable (%i posters)',
    (count) => {
      const pages = buildPosterPages(
        Array.from({ length: count }, (_, i) => poster(i + 1)),
      );
      expect(pages).toHaveLength(count);
      expect(pages.every((page) => page.items.length === 1)).toBe(true);
    },
  );

  it('rotates the slides whenever more than one poster exists', () => {
    expect(shouldRotatePosterPages(1)).toBe(false);
    expect(shouldRotatePosterPages(2)).toBe(true);
    expect(shouldRotatePosterPages(8)).toBe(true);
  });

  it('keeps poster order across the slides', () => {
    const pages = buildPosterPages(
      Array.from({ length: 8 }, (_, i) => poster(i + 1)),
      18,
    );
    expect(pages.map((page) => page.items.map((item) => item.id))).toEqual([
      [1],
      [2],
      [3],
      [4],
      [5],
      [6],
      [7],
      [8],
    ]);
    expect(pages.every((page) => page.displayDuration === 18)).toBe(true);
  });

  it('clamps the configurable page interval to 15–20 seconds', () => {
    expect(buildPosterPages([poster(1)], 4)[0].displayDuration).toBe(15);
    expect(buildPosterPages([poster(1)], 45)[0].displayDuration).toBe(20);
  });
});
