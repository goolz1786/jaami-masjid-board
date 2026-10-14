import { describe, expect, it } from 'vitest';
import {
  formatBoardDateTime,
  formatCurrentTime,
  formatIslamicDate,
} from '../lib/board-dates';

describe('board date formatting', () => {
  it('keeps an existing board working when its saved timezone is invalid', () => {
    expect(formatCurrentTime(new Date('2026-09-12T18:23:00Z'), 'Africa/Johannesberg')).toBe('20:23');
  });
  it('uses the required Gregorian date and time format', () => {
    expect(formatBoardDateTime('2026-09-06T20:00')).toBe(
      '06 September 2026 8:00 pm',
    );
  });

  it('renders an Islamic Umm al-Qura date', () => {
    expect(formatIslamicDate(new Date('2026-09-06T12:00:00+02:00'))).toMatch(
      /^\d{1,2} [A-Za-z’ -]+ 14\d{2} AH$/,
    );
  });

  it('renders the board clock in 24-hour time without seconds', () => {
    expect(
      formatCurrentTime(
        new Date('2026-09-12T18:23:00Z'),
        'Africa/Johannesburg',
      ),
    ).toBe('20:23');
  });
});
