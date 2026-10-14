import type { ContentItem, Priority, Programme } from './masjid-types';

export const JOHANNESBURG_TIMEZONE = 'Africa/Johannesburg';

export function parseBoardDate(value: string): Date | null {
  if (!value) return null;
  const hasOffset = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value);
  const localValue = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `${value}T00:00:00+02:00`
    : `${value}${value.length === 16 ? ':00' : ''}+02:00`;
  const parsed = new Date(hasOffset ? value : localValue);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function boardWeekday(
  now = new Date(),
  timeZone = JOHANNESBURG_TIMEZONE,
): number {
  const short = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
  }).format(now);
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(short);
}

export function boardDateKey(
  date = new Date(),
  timeZone = JOHANNESBURG_TIMEZONE,
): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}

export function programmeOccursToday(
  programme: Pick<Programme, 'eventStart' | 'recurringWeekdays'>,
  now = new Date(),
  timeZone = JOHANNESBURG_TIMEZONE,
): boolean {
  const eventStart = parseBoardDate(programme.eventStart);
  if (eventStart)
    return boardDateKey(eventStart, timeZone) === boardDateKey(now, timeZone);
  return programme.recurringWeekdays.includes(boardWeekday(now, timeZone));
}

export function programmeHasEnded(
  programme: Pick<Programme, 'eventStart' | 'eventEnd' | 'recurringWeekdays'>,
  now = new Date(),
  timeZone = JOHANNESBURG_TIMEZONE,
): boolean {
  if (programme.recurringWeekdays.length > 0 && !programme.eventStart)
    return false;
  const eventEnd = parseBoardDate(programme.eventEnd);
  if (eventEnd) return eventEnd.getTime() < now.getTime();
  const eventStart = parseBoardDate(programme.eventStart);
  return eventStart
    ? boardDateKey(eventStart, timeZone) < boardDateKey(now, timeZone)
    : false;
}

export function resolveJanazahExpiry(
  item: Pick<ContentItem, 'type' | 'endAt' | 'details'>,
): Date | null {
  const explicit = parseBoardDate(item.endAt);
  if (explicit || item.type !== 'JANAZAH') return explicit;
  const burial = item.details.burialDateTime || item.details.janazahDateTime;
  const event = parseBoardDate(burial ?? '');
  if (!event) return null;
  return new Date(event.getTime() + 6 * 60 * 60 * 1000);
}

export function isContentActive(
  item: Pick<
    ContentItem,
    | 'type'
    | 'enabled'
    | 'archived'
    | 'startAt'
    | 'endAt'
    | 'recurringWeekdays'
    | 'details'
  >,
  now = new Date(),
): boolean {
  if (!item.enabled || item.archived) return false;
  const starts = parseBoardDate(item.startAt);
  const ends = resolveJanazahExpiry(item);
  if (starts && starts.getTime() > now.getTime()) return false;
  if (ends && ends.getTime() < now.getTime()) return false;
  return (
    !item.recurringWeekdays.length ||
    item.recurringWeekdays.includes(boardWeekday(now))
  );
}

export function contentStatus(
  item: Pick<
    ContentItem,
    | 'type'
    | 'enabled'
    | 'archived'
    | 'startAt'
    | 'endAt'
    | 'recurringWeekdays'
    | 'details'
  >,
  now = new Date(),
): 'Active' | 'Scheduled' | 'Expired' | 'Disabled' | 'Archived' {
  if (item.archived) return 'Archived';
  if (!item.enabled) return 'Disabled';
  const starts = parseBoardDate(item.startAt);
  if (starts && starts.getTime() > now.getTime()) return 'Scheduled';
  const ends = resolveJanazahExpiry(item);
  if (ends && ends.getTime() < now.getTime()) return 'Expired';
  return isContentActive(item, now) ? 'Active' : 'Scheduled';
}

export function priorityRank(priority: Priority): number {
  return priority === 'URGENT' ? 3 : priority === 'IMPORTANT' ? 2 : 1;
}

export function orderContent<
  T extends { priority: Priority; sortOrder: number },
>(items: T[]): T[] {
  return [...items].sort(
    (a, b) =>
      priorityRank(b.priority) - priorityRank(a.priority) ||
      a.sortOrder - b.sortOrder,
  );
}

export function weightedContent<T extends { priority: Priority }>(
  items: T[],
): T[] {
  return items.flatMap((item) =>
    Array.from({ length: priorityRank(item.priority) }, () => item),
  );
}

export function paginate<T>(items: T[], pageSize = 4): T[][] {
  if (pageSize < 1) throw new Error('pageSize must be at least 1');
  const pages: T[][] = [];
  for (let index = 0; index < items.length; index += pageSize)
    pages.push(items.slice(index, index + pageSize));
  return pages;
}
