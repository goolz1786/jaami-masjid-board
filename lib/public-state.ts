import type { DisplayState } from './masjid-types';
import {
  boardWeekday,
  isContentActive,
  parseBoardDate,
  programmeHasEnded,
} from './content-scheduling';

// Only call with the filtered public state. A library upload alone is private.
export function publicMediaKeys(
  state: DisplayState,
  origin?: string,
): Set<string> {
  const urls = [
    state.settings.logoUrl,
    state.donation.qrImageUrl,
    ...state.programmes.map((item) => item.imageUrl),
    ...state.contentItems.map((item) => item.imageUrl),
  ];
  const keys = new Set<string>();
  for (const url of urls) {
    try {
      let path = url;
      if (origin) {
        const parsed = new URL(url, origin);
        if (parsed.origin !== origin) continue;
        path = parsed.pathname;
      }
      if (!path?.startsWith('/api/media/')) continue;
      const key = decodeURIComponent(
        path.slice('/api/media/'.length).split(/[?#]/)[0],
      );
      if (key.startsWith('media/')) keys.add(key);
    } catch {
      /* Malformed URLs cannot publish a file. */
    }
  }
  return keys;
}

function withinSchedule(from: string, until: string, now: Date) {
  const start = parseBoardDate(from);
  const end = parseBoardDate(until);
  // Malformed nonempty dates must not accidentally publish a notice.
  return (
    (!from || Boolean(start && start <= now)) &&
    (!until || Boolean(end && end >= now))
  );
}

export function publicDisplayState(
  state: DisplayState,
  now = new Date(),
): DisplayState {
  return {
    ...state,
    settings: {
      ...state.settings,
      emergencyMessage: state.settings.emergencyEnabled
        ? state.settings.emergencyMessage
        : '',
    },
    programmes: state.programmes.filter(
      (item) =>
        item.active &&
        !item.archived &&
        withinSchedule(item.displayFrom, item.displayUntil, now) &&
        !programmeHasEnded(item, now, state.settings.timezone),
    ),
    announcements: state.announcements.filter(
      (item) =>
        item.active &&
        !item.archived &&
        withinSchedule(item.startDate, item.endDate, now) &&
        (!item.recurringWeekdays.length ||
          item.recurringWeekdays.includes(
            boardWeekday(now, state.settings.timezone),
          )),
    ),
    contentItems: state.contentItems
      .filter(
        (item) =>
          withinSchedule(item.startAt, item.endAt, now) &&
          isContentActive(item, now),
      )
      .map((item) => ({
        ...item,
        details: Object.fromEntries(
          Object.entries(item.details).filter(([key]) => key !== 'notes'),
        ),
      })),
    hadith: state.hadith.filter((item) => item.active),
    media: [],
    users: [],
    auditLog: [],
  };
}
