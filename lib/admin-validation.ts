import { defaultDonation, defaultSettings, FONT_OPTIONS } from './masjid-types';
import { passwordIsAcceptable } from './security-config';
import { RequestError } from './request-security';

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

const fields = {
  content:
    'id type displayProfile zone title subtitle body imageUrl icon qrUrl details enabled archived sortOrder displayDuration startAt endAt recurringWeekdays priority takeover createdAt updatedAt',
  programme:
    'id title subtitle category imageUrl description dateText startTime endTime venue audience speaker quote quoteSource eventStart eventEnd displayFrom displayUntil active showUpcoming featured sortOrder recurringWeekdays priority displayDuration archived',
  announcement:
    'id title body icon type startDate endDate active panelPosition sortOrder recurringWeekdays priority displayDuration archived',
  hadith: 'id arabic translation reference narrator sortOrder active',
  user: 'id username password role active createdAt root',
  media: 'id filename',
  settings: Object.keys(defaultSettings).join(' '),
  donation: Object.keys(defaultDonation).join(' '),
};
const booleans = new Set(
  'enabled archived takeover active showUpcoming featured tickerEnabled emergencyEnabled root'.split(
    ' ',
  ),
);
const numbers: Record<string, [number, number]> = {
  id: [0, Number.MAX_SAFE_INTEGER],
  sortOrder: [-1_000_000, 1_000_000],
  displayDuration: [5, 300],
  panelPosition: [1, 10],
  refreshInterval: [2, 3600],
  tickerSpeed: [1, 1000],
  hadithDuration: [5, 300],
  upcomingCount: [1, 100],
  communityPosterInterval: [5, 300],
  takeoverDuration: [5, 300],
};
const enums: Record<string, readonly string[]> = {
  priority: ['NORMAL', 'IMPORTANT', 'URGENT'],
  role: ['admin', 'editor'],
  islamicDateSource: ['JAMIAT', 'MANUAL'],
  tickerMode: ['TEXT', 'HADITH'],
  emergencyTheme: ['red', 'gold', 'black'],
  headingFont: FONT_OPTIONS.map((font) => font.key),
  bodyFont: FONT_OPTIONS.map((font) => font.key),
};

export function payloadShapeErrors(entity: string, value: unknown): string[] {
  if (!isRecord(value)) return ['An object payload is required.'];
  const allowed = fields[entity as keyof typeof fields]?.split(' ');
  if (!allowed) return ['Unsupported entity.'];
  const errors: string[] = [];
  for (const [key, field] of Object.entries(value)) {
    if (!allowed.includes(key)) {
      errors.push(`Unsupported field: ${key}.`);
      continue;
    }
    let valid: boolean;
    if (key === 'details') {
      valid =
        isRecord(field) &&
        Object.keys(field).length <= 64 &&
        Object.entries(field).every(
          ([name, text]) =>
            name.length <= 80 &&
            !['__proto__', 'prototype', 'constructor'].includes(name) &&
            typeof text === 'string' &&
            text.length <= 4000,
        );
    } else if (key === 'carouselDurations') {
      valid =
        isRecord(field) &&
        Object.entries(field).every(
          ([zone, duration]) =>
            Object.hasOwn(defaultSettings.carouselDurations, zone) &&
            typeof duration === 'number' &&
            Number.isFinite(duration) &&
            duration >= 5 &&
            duration <= 300,
        );
    } else if (key === 'recurringWeekdays') {
      valid =
        Array.isArray(field) &&
        field.length <= 7 &&
        field.every((day) => Number.isInteger(day) && day >= 0 && day <= 6);
    } else if (booleans.has(key)) valid = typeof field === 'boolean';
    else if (numbers[key])
      valid =
        typeof field === 'number' &&
        Number.isSafeInteger(field) &&
        field >= numbers[key][0] &&
        field <= numbers[key][1];
    else
      valid =
        typeof field === 'string' &&
        field.length <=
          (key === 'password' ? 1024 : key === 'username' ? 128 : 8000);
    if (valid && enums[key]) valid = enums[key].includes(field as string);
    if (
      valid &&
      ['imageUrl', 'logoUrl', 'qrImageUrl', 'qrUrl'].includes(key) &&
      field
    ) {
      const text = field as string;
      valid =
        text.startsWith('/') && !text.startsWith('//') && !text.includes('\\');
      if (!valid) {
        try {
          valid = ['http:', 'https:'].includes(new URL(text).protocol);
        } catch {
          valid = false;
        }
      }
    }
    if (!valid) errors.push(`Invalid ${key}.`);
  }
  return errors;
}

export function validateAdminPayload(entity: string, payload: unknown) {
  const errors = payloadShapeErrors(entity, payload);
  if (errors.length) throw new RequestError(400, errors.join(' '));
  const input = payload as Record<string, unknown>;
  const required: Record<string, string[]> = {
    user: ['username'],
    content: ['title'],
    programme: ['title'],
    announcement: ['title'],
    hadith: ['arabic', 'translation', 'reference'],
    media: ['filename'],
  };
  for (const key of required[entity] ?? []) {
    if (typeof input[key] !== 'string' || !input[key].trim())
      throw new RequestError(400, `${key} is required.`);
  }
  if (entity === 'user') {
    if (
      !['admin', 'editor'].includes(String(input.role)) ||
      typeof input.active !== 'boolean'
    )
      throw new RequestError(
        400,
        'A valid role and active status are required.',
      );
    if ((!input.id || input.password) && !passwordIsAcceptable(input.password))
      throw new RequestError(
        400,
        'Use a unique password of 12 to 1024 characters.',
      );
  }
}
