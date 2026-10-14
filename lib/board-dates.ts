import { parseBoardDate } from './content-scheduling';
import { safeTimeZone } from './timezone';

const islamicMonths = [
  '',
  'Muharram',
  'Safar',
  'Rabi al-Awwal',
  'Rabi al-Thani',
  'Jumada al-Awwal',
  'Jumada al-Thani',
  'Rajab',
  'Sha’ban',
  'Ramadan',
  'Shawwal',
  'Dhul Qa’dah',
  'Dhul Hijjah',
];

function dateParts(
  date: Date,
  locale: string,
  options: Intl.DateTimeFormatOptions,
) {
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: safeTimeZone(options.timeZone) }).formatToParts(date);
}

function part(parts: Intl.DateTimeFormatPart[], type: string) {
  return parts.find((entry) => entry.type === type)?.value ?? '';
}

export function formatBoardDateTime(
  value: string,
  timeZone = 'Africa/Johannesburg',
): string {
  const date = parseBoardDate(value);
  if (!date) return value;
  const parts = dateParts(date, 'en-GB', {
    timeZone: safeTimeZone(timeZone),
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return `${part(parts, 'day')} ${part(parts, 'month')} ${part(parts, 'year')} ${part(parts, 'hour')}:${part(parts, 'minute')} ${part(parts, 'dayPeriod').toLowerCase()}`;
}

export function formatBoardDate(
  value: string,
  timeZone = 'Africa/Johannesburg',
): string {
  const date = parseBoardDate(value);
  if (!date) return value;
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: safeTimeZone(timeZone),
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function formatBoardTime(
  value: string,
  timeZone = 'Africa/Johannesburg',
): string {
  const date = parseBoardDate(value);
  if (!date) return value;
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: safeTimeZone(timeZone),
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
    .format(date)
    .toLowerCase();
}

export function formatWeekday(
  value: string,
  timeZone = 'Africa/Johannesburg',
): string {
  const date = parseBoardDate(value);
  if (!date) return '';
  return new Intl.DateTimeFormat('en-GB', { timeZone: safeTimeZone(timeZone), weekday: 'long' }).format(
    date,
  );
}

export function formatCurrentDate(
  date: Date,
  timeZone = 'Africa/Johannesburg',
): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: safeTimeZone(timeZone),
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function formatCurrentTime(
  date: Date,
  timeZone = 'Africa/Johannesburg',
): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: safeTimeZone(timeZone),
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    hourCycle: 'h23',
  }).format(date);
}

export function formatIslamicDate(
  date: Date,
  timeZone = 'Africa/Johannesburg',
): string {
  const parts = dateParts(date, 'en-US-u-ca-islamic-umalqura', {
    timeZone: safeTimeZone(timeZone),
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  });
  const month = islamicMonths[Number(part(parts, 'month'))] ?? '';
  return `${part(parts, 'day')} ${month} ${part(parts, 'year')} AH`;
}
