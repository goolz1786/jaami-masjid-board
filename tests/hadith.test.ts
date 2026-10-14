import { describe, expect, it } from 'vitest';
import { starterHadith } from '../lib/hadith-library';

describe('starter hadith library', () => {
  it('contains entries from Sahih al-Bukhari or Sahih Muslim only', () =>
    expect(
      starterHadith.every(
        (entry) =>
          /^Sahih al-Bukhari \d+$/.test(entry.reference) ||
          /^Sahih Muslim \d+$/.test(entry.reference),
      ),
    ).toBe(true));
  it('has complete Arabic, translation and reference for every entry', () =>
    expect(
      starterHadith.every(
        (entry) =>
          entry.arabic.trim().length > 0 &&
          entry.translation.trim().length > 0 &&
          entry.reference.trim().length > 0,
      ),
    ).toBe(true));
  it('seeds a substantial starter library', () =>
    expect(starterHadith.length).toBeGreaterThanOrEqual(20));
});
