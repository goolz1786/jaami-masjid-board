import type { ContentItem, ContentType } from './masjid-types';

export const detailFields: Partial<
  Record<ContentType, Array<[string, string, string]>>
> = {
  JANAZAH: [
    ['deceasedName', 'Deceased name', 'text'],
    ['arabicName', 'Arabic name (optional)', 'text'],
    ['relationship', 'Family / relationship wording', 'text'],
    ['leavesFrom', 'Will leave from', 'text'],
    ['pickupDateTime', 'Pick-up date and time', 'datetime-local'],
    ['janazahDateTime', 'Janazah date and time', 'datetime-local'],
    ['janazahLocation', 'Janazah location', 'text'],
    ['burialLocation', 'Burial location', 'text'],
    ['burialDateTime', 'Burial date and time', 'datetime-local'],
    ['dua', 'Short dua / message', 'text'],
  ],
  NIKAH: [
    ['hosts', 'Hosted by (both families)', 'text'],
    ['groomName', 'Groom name', 'text'],
    ['groomParents', "Groom's family wording", 'text'],
    ['brideName', 'Bride name', 'text'],
    ['brideParents', "Bride's family wording", 'text'],
    ['eventDateTime', 'Nikah date and time', 'datetime-local'],
    ['venue', 'Venue', 'text'],
    ['message', 'Message', 'text'],
  ],
  SICK_DUA: [
    ['personName', "Person's name", 'text'],
    ['message', 'Short Dua request / message', 'text'],
    ['arabicDua', 'Arabic Dua (optional)', 'text'],
  ],
  LADIES_TALEEM: [
    ['day', 'Day', 'text'],
    ['time', 'Time', 'text'],
    ['location', 'Location', 'text'],
    ['message', 'Short message', 'text'],
  ],
  EXTERNAL_POSTER: [
    ['organisationName', 'Organisation name', 'text'],
    ['notes', 'Internal notes (optional)', 'text'],
  ],
  DONATION: [
    ['campaign', 'Campaign / fund', 'text'],
    ['note', 'Campaign note', 'text'],
  ],
  LIBRARY: [['availability', 'Availability / collection', 'text']],
};

const detailLabels: Record<string, string> = {
  deceasedName: 'Deceased',
  arabicName: 'Arabic name',
  relationship: 'Family',
  leavesFrom: 'Leaves from',
  pickupDateTime: 'Pick-up',
  janazahDateTime: 'Janazah',
  janazahLocation: 'Janazah at',
  burialLocation: 'Burial at',
  burialDateTime: 'Burial',
  dua: 'Duʿā',
  groomName: 'Groom',
  groomParents: 'Son of',
  brideName: 'Bride',
  brideParents: 'Daughter of',
  brideWording: 'Bride',
  hosts: 'Together with',
  eventDateTime: 'Nikah',
  venue: 'Venue',
  message: 'Message',
  personName: 'Name',
  arabicDua: 'Arabic Duʿā',
  day: 'Day',
  time: 'Time',
  location: 'Location',
  organisationName: 'Organisation',
  notes: 'Notes',
  campaign: 'Campaign',
  note: 'Note',
  availability: 'Availability',
};

export type DetailEntry = { key: string; label: string; value: string };

function cleanLabel(label: string) {
  return label.replace(/\s*\([^)]*\)\s*$/, '').trim();
}

function humanize(key: string) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (character) => character.toUpperCase())
    .trim();
}

export function orderedDetailEntries(
  item: Pick<ContentItem, 'type' | 'details'>,
): DetailEntry[] {
  const definitions = detailFields[item.type] ?? [];
  const entries: DetailEntry[] = [];
  const seen = new Set<string>();
  for (const [key, label] of definitions) {
    const value = item.details[key];
    if (value) {
      entries.push({
        key,
        label: detailLabels[key] ?? cleanLabel(label),
        value,
      });
      seen.add(key);
    }
  }
  for (const [key, value] of Object.entries(item.details)) {
    if (value && !seen.has(key))
      entries.push({ key, label: detailLabels[key] ?? humanize(key), value });
  }
  return entries;
}
