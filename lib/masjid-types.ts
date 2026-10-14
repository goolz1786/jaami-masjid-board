export type Programme = {
  id: number;
  title: string;
  subtitle: string;
  category: string;
  imageUrl: string;
  description: string;
  dateText: string;
  startTime: string;
  endTime: string;
  venue: string;
  audience: string;
  speaker: string;
  quote: string;
  quoteSource: string;
  eventStart: string;
  eventEnd: string;
  displayFrom: string;
  displayUntil: string;
  active: boolean;
  showUpcoming: boolean;
  featured: boolean;
  sortOrder: number;
  recurringWeekdays: number[];
  priority: Priority;
  displayDuration: number;
  archived: boolean;
};

export type Announcement = {
  id: number;
  title: string;
  body: string;
  icon: string;
  type: string;
  startDate: string;
  endDate: string;
  active: boolean;
  panelPosition: number;
  sortOrder: number;
  recurringWeekdays: number[];
  priority: Priority;
  displayDuration: number;
  archived: boolean;
};

export type ContentType =
  | 'GENERAL_NOTICE'
  | 'JANAZAH'
  | 'NIKAH'
  | 'SICK_DUA'
  | 'LADIES_TALEEM'
  | 'EXTERNAL_POSTER'
  | 'WHATSAPP_QR'
  | 'DONATION'
  | 'LIBRARY'
  | 'EMERGENCY';

export type ContentZone =
  | 'MAIN_FEATURE'
  | 'IMPORTANT'
  | 'COMMUNITY'
  | 'LIBRARY'
  | 'DONATE'
  | 'JANAZAH'
  | 'NIKAH'
  | 'SICK_DUA'
  | 'LADIES_TALEEM'
  | 'COMMUNITY_POSTERS'
  | 'WHATSAPP_QR';

export type DisplayProfile =
  | 'MAIN'
  | 'COMMUNITY'
  | 'ENTRANCE'
  | 'LADIES'
  | 'HALL';

export type MainCarouselZone =
  | 'MAIN_FEATURE'
  | 'IMPORTANT'
  | 'COMMUNITY'
  | 'LIBRARY'
  | 'DONATE'
  | 'UPCOMING';

export type Priority = 'NORMAL' | 'IMPORTANT' | 'URGENT';

export function defaultDisplayProfileFor(type: ContentType): DisplayProfile {
  return [
    'JANAZAH',
    'NIKAH',
    'SICK_DUA',
    'LADIES_TALEEM',
    'EXTERNAL_POSTER',
  ].includes(type)
    ? 'COMMUNITY'
    : 'MAIN';
}

export type ContentItem = {
  id: number;
  type: ContentType;
  displayProfile: DisplayProfile;
  zone: ContentZone;
  title: string;
  subtitle: string;
  body: string;
  imageUrl: string;
  icon: string;
  qrUrl: string;
  details: Record<string, string>;
  enabled: boolean;
  archived: boolean;
  sortOrder: number;
  displayDuration: number;
  startAt: string;
  endAt: string;
  recurringWeekdays: number[];
  priority: Priority;
  takeover: boolean;
  createdAt: string;
  updatedAt: string;
};

export type UserSummary = {
  id: number;
  username: string;
  role: 'admin' | 'editor';
  active: boolean;
  createdAt: string;
  root?: boolean;
};

export type AuditEntry = {
  id: number;
  username: string;
  action: string;
  entity: string;
  entityId: number | null;
  summary: string;
  createdAt: string;
};

export type MediaItem = {
  id: number;
  key: string;
  filename: string;
  mimeType: string;
  size: number;
  url: string;
  createdAt: string;
};

export type FontKey =
  | 'montserrat'
  | 'inter'
  | 'poppins'
  | 'playfair'
  | 'lora'
  | 'merriweather'
  | 'roboto-slab'
  | 'amiri'
  | 'georgia'
  | 'arial';

export const FONT_OPTIONS: Array<{ key: FontKey; label: string; css: string }> =
  [
    {
      key: 'montserrat',
      label: 'Montserrat',
      css: 'var(--font-montserrat), Arial, sans-serif',
    },
    {
      key: 'inter',
      label: 'Inter',
      css: 'var(--font-inter), Arial, sans-serif',
    },
    {
      key: 'poppins',
      label: 'Poppins',
      css: 'var(--font-poppins), Arial, sans-serif',
    },
    {
      key: 'playfair',
      label: 'Playfair Display',
      css: 'var(--font-playfair), Georgia, serif',
    },
    {
      key: 'lora',
      label: 'Lora',
      css: 'var(--font-lora), Georgia, serif',
    },
    {
      key: 'merriweather',
      label: 'Merriweather',
      css: 'var(--font-merriweather), Georgia, serif',
    },
    {
      key: 'roboto-slab',
      label: 'Roboto Slab',
      css: 'var(--font-roboto-slab), Georgia, serif',
    },
    {
      key: 'amiri',
      label: 'Amiri',
      css: 'var(--font-amiri), Georgia, serif',
    },
    {
      key: 'georgia',
      label: 'Georgia (system)',
      css: "Georgia, 'Times New Roman', serif",
    },
    {
      key: 'arial',
      label: 'Arial (system)',
      css: 'Arial, Helvetica, sans-serif',
    },
  ];

export function fontCss(key: FontKey | undefined, fallback: string): string {
  return FONT_OPTIONS.find((option) => option.key === key)?.css ?? fallback;
}

export type Settings = {
  masjidName: string;
  masjidSubtitle: string;
  logoUrl: string;
  headerQuote: string;
  headerQuoteSource: string;
  headerRightText: string;
  footerLeftText: string;
  footerCentreText: string;
  footerRightText: string;
  goldAccent: string;
  refreshInterval: number;
  tickerEnabled: boolean;
  tickerSpeed: number;
  tickerText: string;
  tickerMode: 'TEXT' | 'HADITH';
  hadithDuration: number;
  upcomingCount: number;
  communityPosterInterval: number;
  islamicDateSource: 'JAMIAT' | 'MANUAL';
  islamicDateManual: string;
  timezone: string;
  headingFont: FontKey;
  bodyFont: FontKey;
  takeoverDuration: number;
  emergencyEnabled: boolean;
  emergencyMessage: string;
  emergencyTheme: 'red' | 'gold' | 'black';
  carouselDurations: Record<MainCarouselZone, number>;
};

export type IslamicDateState = {
  value: string;
  source: 'JAMIAT' | 'MANUAL' | 'FALLBACK';
  fetchedAt: string;
  lastAttemptAt: string;
  available: boolean;
};

export type DonationSettings = {
  title: string;
  body: string;
  note: string;
  qrUrl: string;
  qrImageUrl: string;
};

export type HadithEntry = {
  id: number;
  arabic: string;
  translation: string;
  reference: string;
  narrator: string;
  sortOrder: number;
  active: boolean;
};

export type DisplayState = {
  settings: Settings;
  islamicDate: IslamicDateState;
  programmes: Programme[];
  announcements: Announcement[];
  media: MediaItem[];
  donation: DonationSettings;
  contentItems: ContentItem[];
  hadith: HadithEntry[];
  users?: UserSummary[];
  auditLog?: AuditEntry[];
  lastUpdated: string;
};

export const defaultSettings: Settings = {
  masjidName: "JAAMI' MASJID",
  masjidSubtitle: 'BEYERS PARK',
  logoUrl: '/assets/jaami-masjid-logo.png',
  headerQuote:
    'And whoever builds a Masjid for the sake of Allah, Allah will build for him a house in Jannah.',
  headerQuoteSource: 'Bukhari & Muslim',
  headerRightText: 'KNOWLEDGE\nWORSHIP\nCOMMUNITY\nA BRIGHTER TOMORROW',
  footerLeftText: "JAAMI' MASJID BEYERS PARK",
  footerCentreText:
    'A CENTRE FOR WORSHIP ♦ A HUB FOR KNOWLEDGE ♦ A STRONGER COMMUNITY ♦ TOGETHER FOR A BETTER TOMORROW',
  footerRightText: 'MAY ALLAH ACCEPT OUR EFFORTS',
  goldAccent: '#B69747',
  refreshInterval: 10,
  tickerEnabled: true,
  tickerSpeed: 42,
  tickerText:
    'A CENTRE FOR WORSHIP ♦ A HUB FOR KNOWLEDGE ♦ A STRONGER COMMUNITY ♦ TOGETHER FOR A BETTER TOMORROW',
  tickerMode: 'TEXT',
  hadithDuration: 12,
  upcomingCount: 4,
  communityPosterInterval: 18,
  islamicDateSource: 'JAMIAT',
  islamicDateManual: '',
  timezone: 'Africa/Johannesburg',
  headingFont: 'montserrat',
  bodyFont: 'inter',
  takeoverDuration: 10,
  emergencyEnabled: false,
  emergencyMessage: 'IMPORTANT: JANAZAH SALAAH AFTER ASR',
  emergencyTheme: 'red',
  carouselDurations: {
    MAIN_FEATURE: 15,
    UPCOMING: 12,
    IMPORTANT: 10,
    COMMUNITY: 12,
    LIBRARY: 15,
    DONATE: 20,
  },
};

export const defaultProgrammes: Programme[] = [];

export const defaultAnnouncements: Announcement[] = [];

export const defaultDonation: DonationSettings = {
  title: 'DONATE',
  body: 'Support the Masjid\nScan the QR code',
  note: 'Make a difference\nfor generations to come.',
  qrUrl: 'https://example.com/donate',
  qrImageUrl: '',
};

export const defaultDisplayState: DisplayState = {
  settings: defaultSettings,
  islamicDate: {
    value: '',
    source: 'FALLBACK',
    fetchedAt: '',
    lastAttemptAt: '',
    available: false,
  },
  programmes: defaultProgrammes,
  announcements: defaultAnnouncements,
  contentItems: [],
  hadith: [],
  media: [],
  donation: defaultDonation,
  lastUpdated: new Date().toISOString(),
};

export function isWithinSchedule(
  from: string,
  until: string,
  now = new Date(),
) {
  const afterStart = !from || new Date(from).getTime() <= now.getTime();
  const beforeEnd = !until || new Date(until).getTime() >= now.getTime();
  return afterStart && beforeEnd;
}
