import type { DisplayState } from './masjid-types';
import {
  fetchJamiatIslamicDate,
  shouldRefreshJamiatDate,
  type JamiatIslamicDateCache,
} from './jamiat-islamic-date';
import { saveIslamicDateCache } from './server-data';

let refreshInFlight: Promise<void> | undefined;

async function refresh(state: DisplayState) {
  const attemptedAt = new Date().toISOString();
  try {
    const value = await fetchJamiatIslamicDate();
    await saveIslamicDateCache({
      value,
      fetchedAt: attemptedAt,
      lastAttemptAt: attemptedAt,
      available: true,
    });
  } catch {
    const previous: JamiatIslamicDateCache = {
      value:
        state.islamicDate.source === 'JAMIAT' ? state.islamicDate.value : '',
      fetchedAt: state.islamicDate.fetchedAt,
      lastAttemptAt: attemptedAt,
      available: false,
    };
    try {
      await saveIslamicDateCache(previous);
    } catch {
      /* Keep serving the existing board state if the cache write also fails. */
    }
    console.warn('The Jamiat Islamic date could not be refreshed.');
  }
}

export async function refreshJamiatDateIfDue(state: DisplayState) {
  if (state.settings.islamicDateSource !== 'JAMIAT') return false;
  const cache: JamiatIslamicDateCache = {
    value: state.islamicDate.source === 'JAMIAT' ? state.islamicDate.value : '',
    fetchedAt: state.islamicDate.fetchedAt,
    lastAttemptAt: state.islamicDate.lastAttemptAt,
    available: state.islamicDate.available,
  };
  if (!shouldRefreshJamiatDate(cache)) return false;
  refreshInFlight ??= refresh(state).finally(() => {
    refreshInFlight = undefined;
  });
  await refreshInFlight;
  return true;
}
