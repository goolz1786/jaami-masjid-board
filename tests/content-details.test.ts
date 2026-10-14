import { describe, expect, it } from 'vitest';
import { orderedDetailEntries } from '../lib/content-details';
import type { ContentItem } from '../lib/masjid-types';

function janazah(
  details: Record<string, string>,
): Pick<ContentItem, 'type' | 'details'> {
  return { type: 'JANAZAH', details };
}

describe('orderedDetailEntries', () => {
  it('orders known fields canonically and labels them', () => {
    const entries = orderedDetailEntries(
      janazah({
        burialDateTime: '2026-09-15T08:15',
        deceasedName: 'MUHAMMED',
        janazahDateTime: '2026-09-15T08:00',
        unknown: '',
      }),
    );
    expect(entries.map((entry) => entry.key)).toEqual([
      'deceasedName',
      'janazahDateTime',
      'burialDateTime',
    ]);
    expect(entries.map((entry) => entry.label)).toEqual([
      'Deceased',
      'Janazah',
      'Burial',
    ]);
  });

  it('drops empty values and appends unknown keys with a humanized label', () => {
    const entries = orderedDetailEntries(
      janazah({ deceasedName: 'A', customField: 'x', blank: '' }),
    );
    expect(entries.map((entry) => entry.key)).toEqual([
      'deceasedName',
      'customField',
    ]);
    expect(entries[1].label).toBe('Custom Field');
  });
});
