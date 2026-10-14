import { describe, expect, it } from 'vitest';
import {
  JAMIAT_REFRESH_MS,
  JAMIAT_RETRY_MS,
  parseJamiatIslamicDate,
  resolveIslamicDate,
  shouldRefreshJamiatDate,
} from '../lib/jamiat-islamic-date';

const cached = {
  value: '30 Rabiʽ al-awwal 1448 AH',
  fetchedAt: '2026-09-12T06:00:00.000Z',
  lastAttemptAt: '2026-09-12T06:00:00.000Z',
  available: true,
};

describe('Jamiat Islamic date', () => {
  it('extracts and normalizes the date from the Jamiat homepage markup', () => {
    const html = `
      <div class="value english gd-out">12 September 2026</div>
      <div class="hd-out value islamic">30 Rabi&#x2bd; al-awwal 1448</div>
    `;
    expect(parseJamiatIslamicDate(html)).toBe('30 Rabiʽ al-awwal 1448 AH');
  });

  it('rejects a missing or malformed Islamic date', () => {
    expect(() => parseJamiatIslamicDate('<div>12 September</div>')).toThrow(
      'not found',
    );
    expect(() =>
      parseJamiatIslamicDate('<div class="islamic hd-out">Tomorrow</div>'),
    ).toThrow('invalid');
  });

  it('uses manual text only while manual mode is selected', () => {
    expect(
      resolveIslamicDate('MANUAL', '  1 Shawwal 1448 AH  ', cached),
    ).toMatchObject({
      value: '1 Shawwal 1448 AH',
      source: 'MANUAL',
    });
    expect(
      resolveIslamicDate('JAMIAT', '1 Shawwal 1448 AH', cached),
    ).toMatchObject({
      value: cached.value,
      source: 'JAMIAT',
    });
  });

  it('refreshes successful data every four hours', () => {
    const last = Date.parse(cached.lastAttemptAt);
    expect(
      shouldRefreshJamiatDate(cached, new Date(last + JAMIAT_REFRESH_MS - 1)),
    ).toBe(false);
    expect(
      shouldRefreshJamiatDate(cached, new Date(last + JAMIAT_REFRESH_MS)),
    ).toBe(true);
  });

  it('retries unavailable data after fifteen minutes', () => {
    const failed = { ...cached, available: false };
    const last = Date.parse(failed.lastAttemptAt);
    expect(
      shouldRefreshJamiatDate(failed, new Date(last + JAMIAT_RETRY_MS - 1)),
    ).toBe(false);
    expect(
      shouldRefreshJamiatDate(failed, new Date(last + JAMIAT_RETRY_MS)),
    ).toBe(true);
  });
});
