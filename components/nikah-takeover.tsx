'use client';

import { MapPin } from 'lucide-react';
import {
  formatBoardDate,
  formatBoardTime,
  formatWeekday,
} from '@/lib/board-dates';
import type { ContentItem } from '@/lib/masjid-types';

export function NikahTakeover({
  item,
  masjidName,
  timeZone = 'Africa/Johannesburg',
}: {
  item: ContentItem;
  masjidName?: string;
  timeZone?: string;
}) {
  const details = item.details;
  const groom = details.groomName || 'Groom';
  const bride =
    details.brideName || details.brideWording || item.subtitle || 'Bride';
  const when = details.eventDateTime
    ? `${formatWeekday(details.eventDateTime, timeZone)}, ${formatBoardDate(details.eventDateTime, timeZone)} · ${formatBoardTime(details.eventDateTime, timeZone)}`
    : '';

  return (
    <section className="urgent-takeover nikah-takeover" aria-live="assertive">
      <div className="nk-frame">
        <div className="nk-kicker">
          <span className="nk-arabic" lang="ar" dir="rtl">
            بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيم
          </span>
          <small>
            In the name of Allah, the Most Gracious, the Most Merciful
          </small>
        </div>

        <div className="nk-script">Nikah</div>

        {details.hosts && <p className="nk-hosts">{details.hosts}</p>}
        <p className="nk-lead">
          request the honour of your presence at the Nikah of
        </p>

        <h2 className="nk-name">{groom}</h2>
        {details.groomParents && (
          <p className="nk-parents">({details.groomParents})</p>
        )}

        <div className="nk-amp">&amp;</div>

        <h2 className="nk-name">{bride}</h2>
        {details.brideParents && (
          <p className="nk-parents">({details.brideParents})</p>
        )}

        {when && <p className="nk-when">on {when}</p>}
        {details.venue && (
          <p className="nk-venue">
            <MapPin aria-hidden="true" /> {details.venue}
          </p>
        )}
        {details.message && <p className="nk-message">{details.message}</p>}
      </div>

      <footer className="nk-foot">
        <strong>{masjidName || "Jaami' Masjid Beyers Park"}</strong>
      </footer>
    </section>
  );
}
