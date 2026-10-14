'use client';

import { Clock3, Home, MapPin, Users } from 'lucide-react';
import { formatBoardDate, formatBoardTime } from '@/lib/board-dates';
import type { ContentItem } from '@/lib/masjid-types';

function valueOrDash(value: string | undefined) {
  return value && value.trim() ? value : '—';
}

export function JanazahTakeover({
  item,
  logoUrl,
  masjidName,
  islamicDate,
  timeZone = 'Africa/Johannesburg',
}: {
  item: ContentItem;
  logoUrl?: string;
  masjidName?: string;
  islamicDate?: string;
  timeZone?: string;
}) {
  const details = item.details;
  const deceased = details.deceasedName || item.title;
  const funeralDate =
    details.janazahDateTime ||
    details.burialDateTime ||
    details.pickupDateTime ||
    '';

  return (
    <section className="urgent-takeover janazah-takeover" aria-live="assertive">
      <header className="jt-header">
        {logoUrl && (
          <div className="jt-logo-plate">
            <img src={logoUrl} alt="Jaami' Masjid" className="jt-logo" />
          </div>
        )}
        <p className="jt-arabic" lang="ar" dir="rtl">
          إِنَّا لِلَّٰهِ وَإِنَّا إِلَيْهِ رَاجِعُونَ
        </p>
        <p className="jt-translation">
          Verily to Allah do we belong &amp; to Him is our return
        </p>
        <h2 className="jt-title">{item.title || 'Janazah Notice'}</h2>
      </header>

      <div className="jt-dates">
        <span>
          {funeralDate ? formatBoardDate(funeralDate, timeZone) : '—'}
        </span>
        <span>{islamicDate || '—'}</span>
      </div>

      <div className="jt-band">The Janazah of</div>
      <h3 className="jt-name">{deceased}</h3>
      {(details.relationship || details.arabicName) && (
        <p className="jt-sub">
          {[details.relationship, details.arabicName]
            .filter(Boolean)
            .join(' · ')}
        </p>
      )}

      <div className="jt-grid">
        <div className="jt-cell">
          <div className="jt-cell-label">
            <Home aria-hidden="true" /> Will leave from
          </div>
          <div className="jt-cell-value">{valueOrDash(details.leavesFrom)}</div>
        </div>
        <div className="jt-cell">
          <div className="jt-cell-label">
            <Users aria-hidden="true" /> Janazah Salaah
          </div>
          <div className="jt-cell-value">
            {valueOrDash(details.janazahLocation || details.burialLocation)}
          </div>
        </div>
        <div className="jt-cell">
          <div className="jt-cell-label">
            <Clock3 aria-hidden="true" /> Pick-up time
          </div>
          <div className="jt-cell-value">
            {details.pickupDateTime
              ? formatBoardTime(details.pickupDateTime, timeZone)
              : '—'}
          </div>
        </div>
        <div className="jt-cell">
          <div className="jt-cell-label">
            <Clock3 aria-hidden="true" /> Salaah time
          </div>
          <div className="jt-cell-value">
            {details.janazahDateTime
              ? formatBoardTime(details.janazahDateTime, timeZone)
              : '—'}
          </div>
        </div>
      </div>

      <div className="jt-cemetery">
        <div className="jt-cell-label jt-cell-label--wide">
          <MapPin aria-hidden="true" /> Burial
        </div>
        <div className="jt-cell-value">
          {valueOrDash(details.burialLocation)}
          {details.burialDateTime
            ? ` · ${formatBoardTime(details.burialDateTime, timeZone)}`
            : ''}
        </div>
      </div>

      {details.dua && <p className="jt-dua">{details.dua}</p>}

      <footer className="jt-footer">
        <strong>{masjidName || "Jaami' Masjid Beyers Park"}</strong>
      </footer>
    </section>
  );
}
