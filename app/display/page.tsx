'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  ChevronRight,
  Clock3,
  HandHeart,
  HeartHandshake,
  Home,
  MapPin,
  MessageCircle,
  Megaphone,
  Users,
  type LucideIcon,
} from 'lucide-react';
import QRCode from 'qrcode';
import { IslamicCorner } from '@/components/islamic-corner';
import { UrgentTakeover } from '@/components/urgent-takeover';
import {
  defaultDisplayState,
  fontCss,
  isWithinSchedule,
  type ContentItem,
  type ContentZone,
  type DisplayState,
  type HadithEntry,
  type MainCarouselZone,
  type Programme,
} from '@/lib/masjid-types';
import {
  boardWeekday,
  isContentActive,
  orderContent,
  paginate,
  parseBoardDate,
  programmeHasEnded,
  programmeOccursToday,
  weightedContent,
} from '@/lib/content-scheduling';
import {
  formatBoardDate,
  formatBoardDateTime,
  formatBoardTime,
  formatCurrentDate,
  formatCurrentTime,
  formatIslamicDate,
  formatWeekday,
} from '@/lib/board-dates';
import { useIndependentCarousel } from '@/hooks/use-independent-carousel';
import { useTakeoverCycle } from '@/hooks/use-takeover-cycle';
import './display.css';

const specialTypes = ['JANAZAH', 'NIKAH', 'SICK_DUA'] as const;
const panelIcons: Record<string, LucideIcon> = {
  megaphone: Megaphone,
  users: Users,
  'heart-handshake': HeartHandshake,
  'hand-heart': HandHeart,
};
const offsets: Record<MainCarouselZone, number> = {
  MAIN_FEATURE: 0,
  UPCOMING: 1500,
  IMPORTANT: 3000,
  COMMUNITY: 5000,
  LIBRARY: 7000,
  DONATE: 9000,
};

type Feature = {
  id: string;
  source: 'programme' | 'content';
  programme?: Programme;
  item?: ContentItem;
  priority: ContentItem['priority'];
  sortOrder: number;
  displayDuration: number;
};
type PanelItem = {
  id: string;
  title: string;
  body: string;
  icon: string;
  imageUrl?: string;
  qrUrl?: string;
  priority: ContentItem['priority'];
  sortOrder: number;
  displayDuration: number;
};

function programmeAvailable(programme: Programme, now: Date, timeZone: string) {
  return (
    programme.active &&
    !programme.archived &&
    isWithinSchedule(programme.displayFrom, programme.displayUntil, now) &&
    !programmeHasEnded(programme, now, timeZone)
  );
}

function programmeFeature(programme: Programme): Feature {
  return {
    id: `programme-${programme.id}`,
    source: 'programme',
    programme,
    priority: programme.priority,
    sortOrder: programme.sortOrder,
    displayDuration: programme.displayDuration,
  };
}

function contentFeature(item: ContentItem): Feature {
  return {
    id: `content-${item.id}`,
    source: 'content',
    item,
    priority: item.priority,
    sortOrder: item.sortOrder,
    displayDuration: item.displayDuration,
  };
}

function panelFromContent(item: ContentItem): PanelItem {
  const detailLines = Object.entries(item.details)
    .filter(([, value]) => value)
    .slice(0, 3)
    .map(([, value]) => value);
  return {
    id: `content-${item.id}`,
    title: item.title,
    body: [item.subtitle, item.body, ...detailLines].filter(Boolean).join('\n'),
    icon: item.icon,
    imageUrl: item.imageUrl,
    qrUrl: item.qrUrl,
    priority: item.priority,
    sortOrder: item.sortOrder,
    displayDuration: item.displayDuration,
  };
}

function programmeDateLabel(programme: Programme, timeZone: string) {
  if (programme.eventStart)
    return formatBoardDateTime(programme.eventStart, timeZone);
  return programme.dateText;
}

function DisplayIcon({ name }: { name: string }) {
  const Icon = panelIcons[name] ?? Megaphone;
  return <Icon strokeWidth={1.7} />;
}

function DonationZone({
  item,
  fallback,
}: {
  item?: PanelItem;
  fallback: DisplayState['donation'];
}) {
  const [generatedQr, setGeneratedQr] = useState('');
  const qrUrl = item?.qrUrl || fallback.qrUrl;
  const suppliedQr = item?.imageUrl || fallback.qrImageUrl;
  useEffect(() => {
    let active = true;
    if (suppliedQr || !qrUrl) {
      const clearQr = window.setTimeout(() => setGeneratedQr(''), 0);
      return () => window.clearTimeout(clearQr);
    }
    void QRCode.toDataURL(qrUrl, {
      width: 300,
      margin: 1,
      color: { dark: '#0C1118', light: '#FFFFFF' },
      errorCorrectionLevel: 'M',
    }).then((url) => active && setGeneratedQr(url));
    return () => {
      active = false;
    };
  }, [qrUrl, suppliedQr]);
  return (
    <article
      className="info-panel donation-panel zone-fade"
      key={item?.id ?? 'default-donation'}
    >
      <HandHeart />
      <div>
        <h3>{item?.title || fallback.title}</h3>
        <p>{item?.body || fallback.body}</p>
        {!item && <small>{fallback.note}</small>}
      </div>
      {(suppliedQr || generatedQr) && (
        <img
          src={suppliedQr || generatedQr}
          alt="Donation QR code"
          className="donation-qr"
        />
      )}
    </article>
  );
}

function WhatsAppZone({ item }: { item?: ContentItem }) {
  const [generatedQr, setGeneratedQr] = useState('');
  useEffect(() => {
    let active = true;
    if (!item?.qrUrl) {
      const clearQr = window.setTimeout(() => setGeneratedQr(''), 0);
      return () => window.clearTimeout(clearQr);
    }
    void QRCode.toDataURL(item.qrUrl, {
      width: 300,
      margin: 1,
      color: { dark: '#07130d', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    }).then((url) => active && setGeneratedQr(url));
    return () => {
      active = false;
    };
  }, [item?.qrUrl]);

  return (
    <article className="info-panel whatsapp-panel zone-fade">
      <MessageCircle aria-hidden="true" />
      <div>
        <h3>{item?.title || 'JOIN OUR WHATSAPP GROUP'}</h3>
        <strong className="whatsapp-audience">FOR MALES ONLY</strong>
        <p>
          {item?.body ||
            'Stay updated with:\nMasjid News\nProgrammes\nAnnouncements'}
        </p>
      </div>
      {generatedQr ? (
        <img
          src={generatedQr}
          alt="Masjid WhatsApp group QR code"
          className="whatsapp-qr"
        />
      ) : (
        <small className="whatsapp-qr-empty">QR</small>
      )}
    </article>
  );
}

function GregorianIslamicDate({
  value,
  timeZone,
}: {
  value: string;
  timeZone: string;
}) {
  const date = parseBoardDate(value);
  if (!date) return null;
  return (
    <div className="dual-date">
      <strong>{formatBoardDate(value, timeZone)}</strong>
      <span>{formatIslamicDate(date, timeZone)}</span>
    </div>
  );
}

function ProgrammeFeature({
  programme,
  timeZone,
}: {
  programme: Programme;
  timeZone: string;
}) {
  return (
    <article className="featured-area programme-feature islamic-pattern zone-fade">
      <div className="feature-image-wrap">
        <img
          src={programme.imageUrl || '/assets/quran-circle.webp'}
          alt=""
          className="feature-image"
        />
      </div>
      <div className="feature-details">
        <div className="category-pill">{programme.category}</div>
        <h2>{programme.title}</h2>
        {programme.subtitle && (
          <div className="feature-subtitle">{programme.subtitle}</div>
        )}
        <div className="feature-meta">
          {(programme.eventStart || programme.dateText) && (
            <div>
              <CalendarDays />
              <strong>{programmeDateLabel(programme, timeZone)}</strong>
            </div>
          )}
          {!programme.eventStart && programme.startTime && (
            <div>
              <Clock3 />
              <strong>
                {programme.startTime}
                {programme.endTime ? ` – ${programme.endTime}` : ''}
              </strong>
            </div>
          )}
          {programme.venue && (
            <div>
              <MapPin /> <strong>{programme.venue}</strong>
            </div>
          )}
          {programme.audience && (
            <div>
              <Users /> <strong>{programme.audience}</strong>
            </div>
          )}
        </div>
        {(programme.description || programme.quote) && (
          <blockquote className="feature-quote">
            {programme.description || `“${programme.quote}”`}
            <cite>{programme.quoteSource && `(${programme.quoteSource})`}</cite>
          </blockquote>
        )}
      </div>
    </article>
  );
}

function JanazahFeature({
  item,
  timeZone,
}: {
  item: ContentItem;
  timeZone: string;
}) {
  const d = item.details;
  const headlineDate = d.janazahDateTime || d.burialDateTime;
  return (
    <article className="featured-area special-feature janazah-feature zone-fade">
      <div className="special-kicker">
        <span className="arabic">إِنَّا لِلَّٰهِ وَإِنَّا إِلَيْهِ رَاجِعُونَ</span>
        <small>Verily to Allah we belong and to Him is our return</small>
      </div>
      <h2>JANAZAH NOTICE</h2>
      {headlineDate && (
        <GregorianIslamicDate value={headlineDate} timeZone={timeZone} />
      )}
      <div className="person-banner">
        <small>THE JANAZAH OF</small>
        <strong>{d.deceasedName}</strong>
        {d.arabicName && <span className="arabic">{d.arabicName}</span>}
        {(d.relationship || item.subtitle) && (
          <p>{d.relationship || item.subtitle}</p>
        )}
      </div>
      <div className="janazah-grid">
        <section>
          <h3>
            <Home /> WILL LEAVE FROM
          </h3>
          <p>{d.leavesFrom || d.janazahLocation || 'To be confirmed'}</p>
          {d.pickupDateTime && (
            <b>{formatBoardTime(d.pickupDateTime, timeZone)}</b>
          )}
        </section>
        <section>
          <h3>
            <Users /> JANAZAH SALAAH
          </h3>
          <p>{d.janazahLocation || 'To be confirmed'}</p>
          {d.janazahDateTime && (
            <b>{formatBoardTime(d.janazahDateTime, timeZone)}</b>
          )}
        </section>
        <section>
          <h3>
            <MapPin /> BURIAL / CEMETERY
          </h3>
          <p>{d.burialLocation || 'To be confirmed'}</p>
          {d.burialDateTime && (
            <b>{formatBoardTime(d.burialDateTime, timeZone)}</b>
          )}
        </section>
      </div>
      {(d.dua || item.body) && (
        <p className="special-message">{d.dua || item.body}</p>
      )}
    </article>
  );
}

function NikahFeature({
  item,
  timeZone,
}: {
  item: ContentItem;
  timeZone: string;
}) {
  const d = item.details;
  return (
    <article className="featured-area special-feature nikah-feature zone-fade">
      <div className="special-kicker">
        <span className="arabic">بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيم</span>
        <small>
          In the name of Allah, the Most Gracious, the Most Merciful
        </small>
      </div>
      <div className="nikah-frame">
        <small>TOGETHER WITH THEIR FAMILIES</small>
        <h2>{d.groomName || 'Groom'}</h2>
        <div className="nikah-ampersand">&amp;</div>
        <h2>{d.brideName || d.brideWording || item.subtitle || 'Bride'}</h2>
        <p>
          request the honour of your presence in celebrating their Nikah, Insha
          Allah
        </p>
        {d.eventDateTime && (
          <div className="nikah-date-grid">
            <strong>{formatWeekday(d.eventDateTime, timeZone)}</strong>
            <strong>{formatBoardDate(d.eventDateTime, timeZone)}</strong>
            <strong>{formatBoardTime(d.eventDateTime, timeZone)}</strong>
          </div>
        )}
        {d.venue && (
          <h3>
            <MapPin /> {d.venue}
          </h3>
        )}
        {(d.message || item.body) && <em>{d.message || item.body}</em>}
      </div>
    </article>
  );
}

function SickDuaFeature({ item }: { item: ContentItem }) {
  const d = item.details;
  const venue = d.venue
    ? /^(at|in)\b/i.test(d.venue)
      ? d.venue
      : `at ${d.venue}`
    : 'at home / in hospital';
  return (
    <article className="featured-area special-feature sick-feature zone-fade">
      <div className="special-kicker">
        <span className="arabic">بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيم</span>
        <small>
          In the name of Allah, the Most Gracious, the Most Merciful
        </small>
      </div>
      <h2>REQUEST FOR DU’A</h2>
      <p className="dua-intro">We humbly request your sincere du’as for</p>
      <div className="sick-name">{d.personName}</div>
      <p className="sick-venue">
        who is currently ill and is <strong>{venue}</strong>.
      </p>
      <p className="dua-prayer">
        May Allah SWT grant them a speedy and complete recovery, ease their
        pain, and accept all our du’as. Ameen.
      </p>
      <div className="dua-box">
        <strong>PROPHETIC DU’A FOR THE SICK</strong>
        <span className="arabic">
          أَذْهِبِ الْبَأْسَ رَبَّ النَّاسِ، وَاشْفِ أَنْتَ الشَّافِي، لَا شِفَاءَ إِلَّا شِفَاؤُكَ، شِفَاءً لَا يُغَادِرُ
          سَقَمًا
        </span>
        <p>
          “Take away the pain, O Lord of mankind, and grant healing, for You are
          the Healer. There is no healing but Your healing, a healing that
          leaves no trace of sickness.”
        </p>
        <small>(Sahih al-Bukhari)</small>
      </div>
    </article>
  );
}

function GenericContentFeature({
  item,
  timeZone,
}: {
  item: ContentItem;
  timeZone: string;
}) {
  const d = item.details;
  const date = d.eventDateTime || d.janazahDateTime;
  return (
    <article className="featured-area generic-content-feature islamic-pattern zone-fade">
      {item.imageUrl && <img src={item.imageUrl} alt="" />}
      <div>
        <div className="category-pill">{item.type.replaceAll('_', ' ')}</div>
        <h2>{item.title}</h2>
        {item.subtitle && <h3>{item.subtitle}</h3>}
        {date && (
          <p>
            <CalendarDays /> {formatBoardDateTime(date, timeZone)}
          </p>
        )}
        {item.body && <blockquote>{item.body}</blockquote>}
      </div>
    </article>
  );
}

function FeatureRenderer({
  feature,
  timeZone,
}: {
  feature: Feature;
  timeZone: string;
}) {
  if (feature.source === 'programme' && feature.programme)
    return (
      <ProgrammeFeature programme={feature.programme} timeZone={timeZone} />
    );
  const item = feature.item;
  if (!item) return null;
  if (item.type === 'JANAZAH')
    return <JanazahFeature item={item} timeZone={timeZone} />;
  if (item.type === 'NIKAH')
    return <NikahFeature item={item} timeZone={timeZone} />;
  if (item.type === 'SICK_DUA') return <SickDuaFeature item={item} />;
  return <GenericContentFeature item={item} timeZone={timeZone} />;
}

export default function DisplayPage() {
  const [state, setState] = useState<DisplayState>(defaultDisplayState);
  const [currentTime, setCurrentTime] = useState(
    () => new Date('2000-01-01T00:00:00Z'),
  );

  useEffect(() => {
    const firstTick = window.setTimeout(() => setCurrentTime(new Date()), 0);
    const clock = window.setInterval(() => setCurrentTime(new Date()), 1000);
    return () => {
      window.clearTimeout(firstTick);
      window.clearInterval(clock);
    };
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch('/api/state', { cache: 'no-store' });
        if (response.ok && active)
          setState((await response.json()) as DisplayState);
      } catch {
        /* Retain the last valid board during network interruption. */
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

  const timeZone = state.settings.timezone || 'Africa/Johannesburg';
  const islamicDate =
    state.islamicDate?.value || formatIslamicDate(currentTime, timeZone);
  const activeContent = useMemo(
    () =>
      state.contentItems.filter(
        (item) =>
          item.displayProfile === 'MAIN' && isContentActive(item, currentTime),
      ),
    [currentTime, state.contentItems],
  );
  const whatsapp = useMemo(
    () =>
      orderContent(
        state.contentItems.filter(
          (item) =>
            item.type === 'WHATSAPP_QR' && isContentActive(item, currentTime),
        ),
      )[0],
    [currentTime, state.contentItems],
  );
  const programmes = useMemo(
    () =>
      state.programmes.filter((item) =>
        programmeAvailable(item, currentTime, timeZone),
      ),
    [currentTime, state.programmes, timeZone],
  );
  const todayProgrammeIds = useMemo(
    () =>
      new Set(
        programmes
          .filter((item) => programmeOccursToday(item, currentTime, timeZone))
          .map((item) => item.id),
      ),
    [currentTime, programmes, timeZone],
  );

  const features = useMemo(() => {
    const selected = new Map<string, Feature>();
    for (const programme of programmes) {
      const recurringIsToday =
        !programme.recurringWeekdays.length ||
        todayProgrammeIds.has(programme.id);
      if (
        (programme.featured && recurringIsToday) ||
        todayProgrammeIds.has(programme.id)
      ) {
        const feature = programmeFeature(programme);
        selected.set(feature.id, feature);
      }
    }
    for (const item of activeContent) {
      if (
        item.zone === 'MAIN_FEATURE' ||
        specialTypes.includes(item.type as (typeof specialTypes)[number])
      ) {
        const feature = contentFeature(item);
        selected.set(feature.id, feature);
      }
    }
    const fallback = programmes[0] ? [programmeFeature(programmes[0])] : [];
    const values = [...selected.values()];
    return weightedContent(orderContent(values.length ? values : fallback));
  }, [activeContent, programmes, todayProgrammeIds]);

  const feature =
    useIndependentCarousel(
      features,
      state.settings.carouselDurations.MAIN_FEATURE,
      offsets.MAIN_FEATURE,
    ) ?? features[0];

  const upcomingPages = useMemo(
    () =>
      paginate(
        programmes
          .filter(
            (item) => item.showUpcoming && !todayProgrammeIds.has(item.id),
          )
          .sort((a, b) => a.sortOrder - b.sortOrder),
        Math.max(1, Math.min(4, state.settings.upcomingCount)),
      ).map((items, index) => ({
        id: `page-${index}-${items.map((item) => item.id).join('-')}`,
        items,
        displayDuration: state.settings.carouselDurations.UPCOMING,
      })),
    [
      programmes,
      state.settings.carouselDurations.UPCOMING,
      state.settings.upcomingCount,
      todayProgrammeIds,
    ],
  );
  const upcomingPage = useIndependentCarousel(
    upcomingPages,
    state.settings.carouselDurations.UPCOMING,
    offsets.UPCOMING,
  );

  const panels = useMemo(() => {
    const legacy = state.announcements.filter(
      (item) =>
        item.active &&
        !item.archived &&
        item.panelPosition !== 3 &&
        isWithinSchedule(item.startDate, item.endDate, currentTime) &&
        (!item.recurringWeekdays.length ||
          item.recurringWeekdays.includes(boardWeekday(currentTime, timeZone))),
    );
    const forZone = (zone: ContentZone, panelPosition: number): PanelItem[] => {
      const content = activeContent
        .filter(
          (item) =>
            item.zone === zone &&
            !specialTypes.includes(item.type as (typeof specialTypes)[number]),
        )
        .map(panelFromContent);
      const old = legacy
        .filter((item) => item.panelPosition === panelPosition)
        .map((item) => ({
          id: `announcement-${item.id}`,
          title: item.title,
          body: item.body,
          icon: item.icon,
          priority: item.priority,
          sortOrder: item.sortOrder,
          displayDuration: item.displayDuration,
        }));
      const defaultItem = defaultDisplayState.announcements.find(
        (item) => item.panelPosition === panelPosition,
      );
      const fallback = defaultItem
        ? [
            {
              id: `default-${panelPosition}`,
              title: defaultItem.title,
              body: defaultItem.body,
              icon: defaultItem.icon,
              priority: defaultItem.priority,
              sortOrder: defaultItem.sortOrder,
              displayDuration: defaultItem.displayDuration,
            },
          ]
        : [];
      return weightedContent(
        orderContent(
          content.length || old.length ? [...content, ...old] : fallback,
        ),
      );
    };
    return {
      important: forZone('IMPORTANT', 1),
      community: forZone('COMMUNITY', 2),
      donate: forZone('DONATE', 4),
    };
  }, [activeContent, currentTime, state.announcements, timeZone]);

  const important = useIndependentCarousel(
    panels.important,
    state.settings.carouselDurations.IMPORTANT,
    offsets.IMPORTANT,
  );
  const community = useIndependentCarousel(
    panels.community,
    state.settings.carouselDurations.COMMUNITY,
    offsets.COMMUNITY,
  );
  const donate = useIndependentCarousel(
    panels.donate,
    state.settings.carouselDurations.DONATE,
    offsets.DONATE,
  );
  const takeovers = useMemo(
    () =>
      orderContent(
        state.contentItems.filter(
          (item) =>
            item.takeover &&
            item.displayProfile === 'MAIN' &&
            isContentActive(item, currentTime),
        ),
      ),
    [currentTime, state.contentItems],
  );
  const hadithEntries = useMemo(
    () => (state.hadith ?? []).filter((entry) => entry.active),
    [state.hadith],
  );
  const takeoverIndex = useTakeoverCycle(
    takeovers.length,
    Math.max(5, state.settings.takeoverDuration || 10) * 1000,
  );
  const takeover = takeoverIndex >= 0 ? takeovers[takeoverIndex] : undefined;
  const gold = state.settings.goldAccent || '#B69747';
  const emergencyClass =
    state.settings.emergencyTheme === 'gold'
      ? 'emergency-gold'
      : state.settings.emergencyTheme === 'black'
        ? 'emergency-black'
        : 'emergency-red';

  return (
    <main
      className="display-viewport"
      style={
        {
          '--board-gold': gold,
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
        className="display-board"
        aria-label="Jaami' Masjid digital display board"
      >
        {takeover && (
          <UrgentTakeover
            item={takeover}
            timeZone={timeZone}
            logoUrl={state.settings.logoUrl || '/assets/jaami-masjid-logo.png'}
          />
        )}
        {state.settings.emergencyEnabled && (
          <div className={`emergency-banner ${emergencyClass}`}>
            {state.settings.emergencyMessage}
          </div>
        )}
        <header className="board-header islamic-pattern">
          <div className="brand-area">
            <img
              src={state.settings.logoUrl || '/assets/jaami-masjid-logo.png'}
              alt="Jaami' Masjid Beyers Park"
              className="brand-logo"
            />
          </div>
          <div className="board-clock">
            <IslamicCorner className="main-clock-corner" />
            <strong>{formatCurrentTime(currentTime, timeZone)}</strong>
            <span>{formatCurrentDate(currentTime, timeZone)}</span>
            <em>{islamicDate}</em>
          </div>
        </header>
        <section
          className={`main-row ${upcomingPages.length ? '' : 'main-row-expanded'}`}
        >
          <div className="feature-slot" key={feature?.id}>
            {feature && (
              <FeatureRenderer feature={feature} timeZone={timeZone} />
            )}
          </div>
          {upcomingPages.length > 0 && (
            <aside className="upcoming-area">
              <h2>
                <CalendarDays /> UPCOMING PROGRAMMES
              </h2>
              <div className="upcoming-list zone-fade" key={upcomingPage?.id}>
                {(upcomingPage?.items ?? []).map((programme) => (
                  <article className="upcoming-item" key={programme.id}>
                    <img
                      src={programme.imageUrl || '/assets/masjid-sunset.webp'}
                      alt=""
                    />
                    <div>
                      <h3>{programme.title}</h3>
                      {programme.subtitle && <em>{programme.subtitle}</em>}
                      <p>
                        {[
                          programmeDateLabel(programme, timeZone),
                          !programme.eventStart && programme.startTime,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                    <ChevronRight aria-hidden="true" />
                  </article>
                ))}
              </div>
            </aside>
          )}
        </section>
        <section className="info-row">
          {important && <InfoPanel item={important} className="panel-1" />}
          {community && <InfoPanel item={community} className="panel-2" />}
          <DonationZone item={donate} fallback={state.donation} />
          <WhatsAppZone item={whatsapp} />
        </section>
        <footer className="board-footer">
          <strong>{state.settings.footerLeftText}</strong>
          <div className="ticker-window">
            {state.settings.tickerMode === 'HADITH' && hadithEntries.length ? (
              <HadithBar
                key={hadithEntries.map((entry) => entry.id).join('-')}
                entries={hadithEntries}
                duration={state.settings.hadithDuration}
              />
            ) : (
              <div
                className={state.settings.tickerEnabled ? 'ticker-track' : ''}
                style={{
                  animationDuration: `${Math.max(12, state.settings.tickerSpeed)}s`,
                }}
              >
                <span>
                  {state.settings.tickerEnabled
                    ? state.settings.tickerText
                    : state.settings.footerCentreText}
                </span>
                {state.settings.tickerEnabled && (
                  <span aria-hidden="true">{state.settings.tickerText}</span>
                )}
              </div>
            )}
          </div>
          <strong>◆ &nbsp;{state.settings.footerRightText}</strong>
        </footer>
      </section>
    </main>
  );
}

function InfoPanel({
  item,
  className,
}: {
  item: PanelItem;
  className: string;
}) {
  return (
    <article className={`info-panel ${className} zone-fade`} key={item.id}>
      <DisplayIcon name={item.icon} />
      <div>
        <h3>{item.title}</h3>
        <p>{item.body}</p>
      </div>
    </article>
  );
}

function HadithBar({
  entries,
  duration,
}: {
  entries: HadithEntry[];
  duration: number;
}) {
  const [index, setIndex] = useState(0);
  const count = entries.length;
  useEffect(() => {
    if (count < 2) return;
    const timer = window.setInterval(
      () => setIndex((current) => (current + 1) % count),
      Math.max(5, duration) * 1000,
    );
    return () => window.clearInterval(timer);
  }, [count, duration]);
  const hadith = entries[index % Math.max(1, count)];
  if (!hadith) return null;
  return (
    <article className="hadith-bar zone-fade" key={hadith.id}>
      <div className="hadith-arabic" dir="rtl" lang="ar">
        {hadith.arabic}
      </div>
      <div className="hadith-english">
        <p>{hadith.translation}</p>
        <span className="hadith-ref">
          {hadith.narrator ? `${hadith.narrator} · ` : ''}
          {hadith.reference}
        </span>
      </div>
    </article>
  );
}
