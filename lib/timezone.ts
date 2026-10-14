export const DEFAULT_TIMEZONE = 'Africa/Johannesburg';

export function isValidTimeZone(value: unknown): value is string {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: value.trim() });
    return true;
  } catch {
    return false;
  }
}

export function safeTimeZone(value: unknown): string {
  return isValidTimeZone(value) ? value.trim() : DEFAULT_TIMEZONE;
}
