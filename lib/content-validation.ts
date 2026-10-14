import type {
  ContentItem,
  ContentType,
  ContentZone,
  DisplayProfile,
} from './masjid-types';

const types: ContentType[] = [
  'GENERAL_NOTICE',
  'JANAZAH',
  'NIKAH',
  'SICK_DUA',
  'LADIES_TALEEM',
  'EXTERNAL_POSTER',
  'WHATSAPP_QR',
  'DONATION',
  'LIBRARY',
  'EMERGENCY',
];
const zones: ContentZone[] = [
  'MAIN_FEATURE',
  'IMPORTANT',
  'COMMUNITY',
  'LIBRARY',
  'DONATE',
  'JANAZAH',
  'NIKAH',
  'SICK_DUA',
  'LADIES_TALEEM',
  'COMMUNITY_POSTERS',
  'WHATSAPP_QR',
];
const profiles: DisplayProfile[] = [
  'MAIN',
  'COMMUNITY',
  'ENTRANCE',
  'LADIES',
  'HALL',
];

export function validateContentItem(item: ContentItem): string[] {
  const errors: string[] = [];
  if (!item.title.trim()) errors.push('A title is required.');
  if (!types.includes(item.type)) errors.push('Invalid content type.');
  if (!profiles.includes(item.displayProfile))
    errors.push('Invalid display profile.');
  if (!zones.includes(item.zone)) errors.push('Invalid target zone.');
  if (item.displayDuration < 5 || item.displayDuration > 300)
    errors.push('Display duration must be between 5 and 300 seconds.');
  if (
    item.recurringWeekdays.some(
      (day) => !Number.isInteger(day) || day < 0 || day > 6,
    )
  )
    errors.push(
      'Recurring weekdays must be between Sunday (0) and Saturday (6).',
    );
  if (item.type === 'JANAZAH' && !item.details.deceasedName)
    errors.push('The deceased name is required.');
  if (item.type === 'NIKAH' && !item.details.groomName && !item.subtitle)
    errors.push('Nikah wording or a groom name is required.');
  if (item.type === 'SICK_DUA' && !item.details.personName)
    errors.push("The person's name is required.");
  if (item.type === 'EXTERNAL_POSTER' && !item.imageUrl)
    errors.push('A poster file is required.');
  if (item.type === 'WHATSAPP_QR' && !item.qrUrl)
    errors.push('A WhatsApp invite URL is required.');
  return errors;
}

export function duplicateContentItem(item: ContentItem): ContentItem {
  const timestamp = new Date().toISOString();
  return {
    ...item,
    id: 0,
    title: `${item.title} (copy)`,
    enabled: false,
    archived: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

const EDITOR_ENTITIES = new Set(['content', 'media', 'hadith']);

export function canManage(entity: string, role: 'admin' | 'editor') {
  return role === 'admin' || EDITOR_ENTITIES.has(entity);
}
