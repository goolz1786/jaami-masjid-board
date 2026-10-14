'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  BookOpen,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  HeartHandshake,
  HandHeart,
  Home,
  Images,
  MapPin,
  Users,
} from 'lucide-react';
import { IslamicCorner } from '@/components/islamic-corner';
import { JanazahTakeover } from '@/components/janazah-takeover';
import { NikahTakeover } from '@/components/nikah-takeover';
import { PdfPoster } from '@/components/pdf-poster';
import { UrgentTakeover } from '@/components/urgent-takeover';
import { useIndependentCarousel } from '@/hooks/use-independent-carousel';
import { useTakeoverCycle } from '@/hooks/use-takeover-cycle';
import { isContentActive, orderContent } from '@/lib/content-scheduling';
import {
  buildPosterPages,
  posterLayoutClass,
  shouldRotatePosterPages,
} from '@/lib/community-posters';
import {
  formatBoardDate,
  formatBoardTime,
  formatCurrentDate,
  formatCurrentTime,
  formatIslamicDate,
  formatWeekday,
} from '@/lib/board-dates';
import {
  defaultDisplayState,
  fontCss,
  type ContentItem,
  type DisplayState,
} from '@/lib/masjid-types';
import './community.css';

type NoticePanelProps = {
  item?: ContentItem;
  timeZone: string;
};

type HeadingIcon = typeof CalendarDays;

function PanelHeading({
  icon: Icon,
  children,
}: {
  icon: HeadingIcon;
  children: React.ReactNode;
}) {
  return (
    <div className="community-panel-heading">
      <Icon aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}

function useLiveBoardState() {
  const [state, setState] = useState<DisplayState>(defaultDisplayState);
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch('/api/state', { cache: 'no-store' });
        if (response.ok && active)
          setState((await response.json()) as DisplayState);
      } catch {
        /* Keep the last valid board visible until the server reconnects. */
      }
    };
    void load();
    const timer = window.setInterval(
      load,
      Math.max(3, state.settings.refreshInterval) * 1000,
    );
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [state.settings.refreshInterval]);
  return state;
}

function EmptyNotice({
  label,
  message,
  prayer,
  icon: Icon,
  className = '',
}: {
  label: string;
  message: string;
  prayer?: string;
  icon: HeadingIcon;
  className?: string;
}) {
  return (
    <article className={`community-panel community-empty ${className}`}>
      <PanelHeading icon={Icon}>{label}</PanelHeading>
      <div className="community-empty-copy">
        <Icon aria-hidden="true" />
        <strong>{message}</strong>
        {prayer && <em>{prayer}</em>}
      </div>
    </article>
  );
}

function MetaLine({
  icon: Icon,
  children,
}: {
  icon: typeof CalendarDays;
  children?: React.ReactNode;
}) {
  if (!children) return null;
  return (
    <div className="community-meta-line">
      <Icon aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}

function JanazahPanel({ item, timeZone }: NoticePanelProps) {
  if (!item)
    return (
      <EmptyNotice
        label="JANAZAH ANNOUNCEMENT"
        message="No current Janazah notice"
        prayer="May Allah grant all deceased Muslims Jannatul Firdaus."
        icon={Bell}
        className="janazah-card"
      />
    );
  const d = item.details;
  return (
    <article className="community-panel janazah-card community-fade">
      <PanelHeading icon={Bell}>JANAZAH ANNOUNCEMENT</PanelHeading>
      <div className="janazah-content">
        <span className="arabic janazah-arabic">إِنَّا لِلَّٰهِ وَإِنَّا إِلَيْهِ رَاجِعُونَ</span>
        <h2>{d.deceasedName || item.title}</h2>
        {(d.relationship || d.arabicName) && (
          <p className="janazah-relationship">
            {[d.relationship, d.arabicName].filter(Boolean).join(' · ')}
          </p>
        )}
        <div className="janazah-details">
          <div className="janazah-detail">
            <span className="janazah-detail-label">
              <Home aria-hidden="true" /> Will leave from
            </span>
            <span className="janazah-detail-value">{d.leavesFrom || '—'}</span>
          </div>
          <div className="janazah-detail">
            <span className="janazah-detail-label">
              <Users aria-hidden="true" /> Janazah Salaah
            </span>
            <span className="janazah-detail-value">
              {d.janazahLocation || d.burialLocation || '—'}
            </span>
          </div>
          <div className="janazah-detail">
            <span className="janazah-detail-label">
              <Clock3 aria-hidden="true" /> Pick-up
            </span>
            <span className="janazah-detail-value">
              {d.pickupDateTime
                ? formatBoardTime(d.pickupDateTime, timeZone)
                : '—'}
            </span>
          </div>
          <div className="janazah-detail">
            <span className="janazah-detail-label">
              <Clock3 aria-hidden="true" /> Salaah time
            </span>
            <span className="janazah-detail-value">
              {d.janazahDateTime
                ? formatBoardTime(d.janazahDateTime, timeZone)
                : '—'}
            </span>
          </div>
          <div className="janazah-detail janazah-detail-wide">
            <span className="janazah-detail-label">
              <MapPin aria-hidden="true" /> Burial
            </span>
            <span className="janazah-detail-value">
              {d.burialLocation || '—'}
              {d.burialDateTime
                ? ` · ${formatBoardTime(d.burialDateTime, timeZone)}`
                : ''}
            </span>
          </div>
        </div>
        {(d.dua || item.body) && (
          <p className="janazah-dua">{d.dua || item.body}</p>
        )}
      </div>
    </article>
  );
}

function NikahPanel({ item, timeZone }: NoticePanelProps) {
  if (!item)
    return (
      <EmptyNotice
        label="NIKAH ANNOUNCEMENT"
        message="No current Nikah announcement"
        prayer="May Allah place Barakah in all marriages."
        icon={HeartHandshake}
      />
    );
  const d = item.details;
  const groom = d.groomName || 'Groom';
  const bride = d.brideName || d.brideWording || item.subtitle || 'Bride';
  return (
    <article className="community-panel small-notice-card nikah-card community-fade">
      <PanelHeading icon={HeartHandshake}>NIKAH ANNOUNCEMENT</PanelHeading>
      <div className="nikah-content">
        <span className="nikah-script" aria-hidden="true">
          Nikah
        </span>
        {d.hosts && <p className="nikah-hosts">{d.hosts}</p>}
        <div className="nikah-names">
          <strong>{groom}</strong>
          <span className="nikah-amp">&amp;</span>
          <strong>{bride}</strong>
        </div>
        {d.eventDateTime && (
          <p className="nikah-when">
            {formatWeekday(d.eventDateTime, timeZone)},{' '}
            {formatBoardDate(d.eventDateTime, timeZone)} ·{' '}
            {formatBoardTime(d.eventDateTime, timeZone)}
          </p>
        )}
        {d.venue && (
          <p className="nikah-venue">
            <MapPin aria-hidden="true" /> {d.venue}
          </p>
        )}
      </div>
    </article>
  );
}

function SickDuaPanel({ item }: { item?: ContentItem }) {
  if (!item)
    return (
      <EmptyNotice
        label="SICK / DUA REQUEST"
        message="Please remember the sick in your Duas."
        prayer="May Allah grant Shifa to all those who are ill."
        icon={HandHeart}
      />
    );
  const d = item.details;
  return (
    <article className="community-panel small-notice-card community-fade">
      <PanelHeading icon={HandHeart}>SICK / DUA REQUEST</PanelHeading>
      <div className="small-notice-body dua-body">
        <Users aria-hidden="true" />
        <div>
          <h2>{d.personName}</h2>
          {(d.message || item.body) && <p>{d.message || item.body}</p>}
          {d.arabicDua && <p className="arabic dua-arabic">{d.arabicDua}</p>}
        </div>
      </div>
    </article>
  );
}

function LadiesTaleemPanel({ item }: { item?: ContentItem }) {
  if (!item)
    return (
      <EmptyNotice
        label="LADIES TALEEM"
        message="Programme information will appear here"
        prayer="Knowledge • Imaan • Sisterhood"
        icon={BookOpen}
        className="taleem-card"
      />
    );
  const d = item.details;
  return (
    <article className="community-panel taleem-card community-fade">
      <PanelHeading icon={BookOpen}>LADIES TALEEM</PanelHeading>
      {item.imageUrl && <img src={item.imageUrl} alt="" />}
      <div className="taleem-copy">
        <h2>{item.title}</h2>
        {item.subtitle && <p className="taleem-subtitle">{item.subtitle}</p>}
        <div className="taleem-meta">
          <MetaLine icon={CalendarDays}>{d.day}</MetaLine>
          <MetaLine icon={Clock3}>{d.time}</MetaLine>
          <MetaLine icon={MapPin}>{d.location}</MetaLine>
          <MetaLine icon={Users}>{d.message || item.body}</MetaLine>
        </div>
      </div>
    </article>
  );
}

function PosterMedia({ item }: { item: ContentItem }) {
  const isPdf =
    item.details.posterMimeType === 'application/pdf' ||
    item.imageUrl.toLowerCase().includes('.pdf');
  if (isPdf) return <PdfPoster src={item.imageUrl} title={item.title} />;
  return <img src={item.imageUrl} alt={item.title} />;
}

function PosterWall({
  items,
  pageNumber,
  pageCount,
}: {
  items: ContentItem[];
  pageNumber: number;
  pageCount: number;
}) {
  return (
    <section className="community-panel posters-card">
      <div className="posters-heading">
        <span>
          <Images aria-hidden="true" /> COMMUNITY POSTERS
        </span>
        {pageCount > 1 && (
          <small className="poster-pagination">
            <ChevronLeft /> {pageNumber} / {pageCount} <ChevronRight />
          </small>
        )}
      </div>
      {items.length ? (
        <div
          className={`poster-grid ${posterLayoutClass(items.length)} community-fade`}
        >
          {items.map((item) => (
            <article className="poster-frame" key={item.id}>
              <PosterMedia item={item} />
              <div className="poster-caption">
                <strong>{item.title}</strong>
                {item.details.organisationName && (
                  <span>{item.details.organisationName}</span>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="posters-empty">
          <Images />
          <span>Community posters will appear here</span>
        </div>
      )}
    </section>
  );
}

export default function CommunityDisplayPage() {
  const state = useLiveBoardState();
  const [currentTime, setCurrentTime] = useState(
    () => new Date('2000-01-01T00:00:00Z'),
  );
  useEffect(() => {
    const tick = window.setTimeout(() => setCurrentTime(new Date()), 0);
    const timer = window.setInterval(() => setCurrentTime(new Date()), 1000);
    return () => {
      window.clearTimeout(tick);
      window.clearInterval(timer);
    };
  }, []);

  const active = useMemo(
    () =>
      state.contentItems.filter(
        (item) =>
          item.displayProfile === 'COMMUNITY' &&
          isContentActive(item, currentTime),
      ),
    [currentTime, state.contentItems],
  );
  const byType = (type: ContentItem['type']) =>
    orderContent(active.filter((item) => item.type === type));
  const janazahItems = byType('JANAZAH');
  const nikahItems = byType('NIKAH');
  const sickItems = byType('SICK_DUA');
  const taleemItems = byType('LADIES_TALEEM');
  const posters = active
    .filter((item) => item.type === 'EXTERNAL_POSTER')
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
  const posterPages = buildPosterPages(
    posters,
    state.settings.communityPosterInterval,
  );
  const janazah = useIndependentCarousel(janazahItems, 15, 0);
  const nikah = useIndependentCarousel(nikahItems, 15, 1700);
  const sick = useIndependentCarousel(sickItems, 15, 3200);
  const taleem = useIndependentCarousel(taleemItems, 20, 4700);
  const rotatingPosterPage = useIndependentCarousel(
    shouldRotatePosterPages(posters.length) ? posterPages : [],
    state.settings.communityPosterInterval || 18,
    0,
  );
  const posterPage = rotatingPosterPage ?? posterPages[0];
  const takeovers = useMemo(
    () =>
      orderContent(
        state.contentItems.filter(
          (item) =>
            item.takeover &&
            item.displayProfile === 'COMMUNITY' &&
            isContentActive(item, currentTime),
        ),
      ),
    [currentTime, state.contentItems],
  );
  const takeoverIndex = useTakeoverCycle(
    takeovers.length,
    Math.max(5, state.settings.takeoverDuration || 10) * 1000,
  );
  const takeover = takeoverIndex >= 0 ? takeovers[takeoverIndex] : undefined;
  const timeZone = state.settings.timezone || 'Africa/Johannesburg';
  const islamicDate =
    state.islamicDate?.value || formatIslamicDate(currentTime, timeZone);
  const posterPageIndex = posterPage
    ? Math.max(
        0,
        posterPages.findIndex((page) => page.id === posterPage.id),
      )
    : 0;

  return (
    <main
      className="community-viewport"
      style={
        {
          '--community-gold': state.settings.goldAccent || '#b69747',
          '--board-gold': state.settings.goldAccent || '#b69747',
          '--font-montserrat': fontCss(
            state.settings.headingFont,
            'var(--font-montserrat), Arial, sans-serif',
          ),
          '--font-inter': fontCss(
            state.settings.bodyFont,
            'var(--font-inter), Arial, sans-serif',
          ),
        } as React.CSSProperties
      }
    >
      <section
        className="community-board"
        aria-label="Jaami' Masjid Community Notice Board"
      >
        <header className="community-header community-pattern">
          <img
            src={state.settings.logoUrl || '/assets/jaami-masjid-logo.png'}
            alt="Jaami' Masjid Beyers Park"
          />
          <div className="community-clock">
            <IslamicCorner className="community-clock-corner" />
            <strong>{formatCurrentTime(currentTime, timeZone)}</strong>
            <span>{formatCurrentDate(currentTime, timeZone)}</span>
            <em>{islamicDate}</em>
          </div>
        </header>
        <section className="community-top-row">
          <JanazahPanel item={janazah} timeZone={timeZone} />
          <LadiesTaleemPanel item={taleem} />
        </section>
        <PosterWall
          items={posterPage?.items ?? []}
          pageNumber={posterPageIndex + 1}
          pageCount={posterPages.length}
        />
        <section className="community-bottom-row">
          <NikahPanel item={nikah} timeZone={timeZone} />
          <SickDuaPanel item={sick} />
        </section>
        <footer className="community-footer">
          <strong>{state.settings.footerLeftText}</strong>
          <span>◆</span>
          <strong>SERVING OUR COMMUNITY</strong>
          <span>◆</span>
          <strong>SPREADING GOODNESS</strong>
        </footer>
        {takeover &&
          (takeover.type === 'JANAZAH' ? (
            <JanazahTakeover
              item={takeover}
              timeZone={timeZone}
              logoUrl={
                state.settings.logoUrl || '/assets/jaami-masjid-logo.png'
              }
              masjidName={state.settings.masjidName}
              islamicDate={islamicDate}
            />
          ) : takeover.type === 'NIKAH' ? (
            <NikahTakeover
              item={takeover}
              timeZone={timeZone}
              masjidName={state.settings.masjidName}
            />
          ) : (
            <UrgentTakeover
              item={takeover}
              timeZone={timeZone}
              logoUrl={
                state.settings.logoUrl || '/assets/jaami-masjid-logo.png'
              }
            />
          ))}
      </section>
    </main>
  );
}
