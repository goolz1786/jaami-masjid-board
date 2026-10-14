'use client';

import { formatBoardDate, formatBoardDateTime } from '@/lib/board-dates';
import { orderedDetailEntries } from '@/lib/content-details';
import type { ContentItem } from '@/lib/masjid-types';

const DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const PROMINENT_DETAILS = new Set(['deceasedName', 'personName', 'groomName']);

function formatDetail(value: string, timeZone: string): string {
  if (DATE_TIME.test(value)) return formatBoardDateTime(value, timeZone);
  if (DATE_ONLY.test(value)) return formatBoardDate(value, timeZone);
  return value;
}

export function UrgentTakeover({
  item,
  logoUrl,
  timeZone = 'Africa/Johannesburg',
}: {
  item: ContentItem;
  logoUrl?: string;
  timeZone?: string;
}) {
  const details = orderedDetailEntries(item);
  return (
    <section className="urgent-takeover" aria-live="assertive">
      {logoUrl && <img src={logoUrl} alt="Jaami' Masjid" />}
      <strong>{item.type.replaceAll('_', ' ')}</strong>
      <h2>{item.title}</h2>
      {item.subtitle && <h3>{item.subtitle}</h3>}
      {item.body && <p>{item.body}</p>}
      {details.length > 0 && (
        <ul className="takeover-details">
          {details.map((entry) => (
            <li key={entry.key}>
              <span className="takeover-detail-label">{entry.label}</span>
              <span
                className={`takeover-detail-value${
                  PROMINENT_DETAILS.has(entry.key)
                    ? ' takeover-detail-value-lg'
                    : ''
                }`}
              >
                {formatDetail(entry.value, timeZone)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
