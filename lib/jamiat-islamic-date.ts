export const JAMIAT_ISLAMIC_DATE_URL = 'https://jamiat.org.za/';
export const JAMIAT_REFRESH_MS = 4 * 60 * 60 * 1000;
export const JAMIAT_RETRY_MS = 15 * 60 * 1000;

export type JamiatIslamicDateCache = {
  value: string;
  fetchedAt: string;
  lastAttemptAt: string;
  available: boolean;
};

export type ResolvedIslamicDate = JamiatIslamicDateCache & {
  source: 'JAMIAT' | 'MANUAL' | 'FALLBACK';
};

function decodeHtml(value: string) {
  const named: Record<string, string> = {
    amp: '&',
    apos: "'",
    gt: '>',
    lt: '<',
    nbsp: ' ',
    quot: '"',
  };
  return value.replace(
    /&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,
    (entity, code: string) => {
      if (code.startsWith('#x'))
        return String.fromCodePoint(Number.parseInt(code.slice(2), 16));
      if (code.startsWith('#'))
        return String.fromCodePoint(Number.parseInt(code.slice(1), 10));
      return named[code.toLowerCase()] ?? entity;
    },
  );
}

export function parseJamiatIslamicDate(html: string) {
  const match = Array.from(
    html.matchAll(/<div\b([^>]*)>([\s\S]*?)<\/div>/gi),
  ).find((candidate) => {
    const className = candidate[1].match(/class=["']([^"']*)["']/i)?.[1] ?? '';
    const classes = className.toLowerCase().split(/\s+/);
    return classes.includes('islamic') && classes.includes('hd-out');
  });
  if (!match) throw new Error('Jamiat Islamic date was not found.');
  const value = decodeHtml(match[2].replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
  if (!/^\d{1,2}\s+.+\s+14\d{2}(?:\s+AH)?$/u.test(value) || value.length > 80)
    throw new Error('Jamiat returned an invalid Islamic date.');
  return /\sAH$/i.test(value) ? value : `${value} AH`;
}

export function resolveIslamicDate(
  source: 'JAMIAT' | 'MANUAL',
  manualValue: string,
  cache: JamiatIslamicDateCache,
): ResolvedIslamicDate {
  const manual = manualValue.trim();
  if (source === 'MANUAL' && manual) {
    return {
      value: manual,
      source: 'MANUAL',
      fetchedAt: '',
      lastAttemptAt: cache.lastAttemptAt,
      available: true,
    };
  }
  return {
    ...cache,
    source: cache.value ? 'JAMIAT' : 'FALLBACK',
  };
}

export function shouldRefreshJamiatDate(
  cache: JamiatIslamicDateCache,
  now = new Date(),
) {
  const lastAttempt = Date.parse(cache.lastAttemptAt);
  if (!Number.isFinite(lastAttempt)) return true;
  const interval = cache.available ? JAMIAT_REFRESH_MS : JAMIAT_RETRY_MS;
  return now.getTime() - lastAttempt >= interval;
}

export async function fetchJamiatIslamicDate(fetcher: typeof fetch = fetch) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetcher(JAMIAT_ISLAMIC_DATE_URL, {
      cache: 'no-store',
      headers: { Accept: 'text/html,application/xhtml+xml' },
      signal: controller.signal,
    });
    if (!response.ok)
      throw new Error(
        `Jamiat Islamic date request failed (${response.status}).`,
      );
    return parseJamiatIslamicDate(await response.text());
  } finally {
    clearTimeout(timeout);
  }
}
