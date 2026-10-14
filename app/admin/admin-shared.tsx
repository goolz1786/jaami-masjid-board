'use client';

import { Star } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { contentStatus } from '@/lib/content-scheduling';
import {
  defaultDisplayProfileFor,
  type Announcement,
  type ContentItem,
  type ContentType,
  type ContentZone,
  type Programme,
} from '@/lib/masjid-types';

export const blankProgramme: Programme = {
  id: 0,
  title: '',
  subtitle: '',
  category: 'PROGRAMME',
  imageUrl: '',
  description: '',
  dateText: '',
  startTime: '',
  endTime: '',
  venue: '',
  audience: '',
  speaker: '',
  quote: '',
  quoteSource: '',
  eventStart: '',
  eventEnd: '',
  displayFrom: '',
  displayUntil: '',
  active: true,
  showUpcoming: true,
  featured: false,
  sortOrder: 10,
  recurringWeekdays: [],
  priority: 'NORMAL',
  displayDuration: 15,
  archived: false,
};
export const blankAnnouncement: Announcement = {
  id: 0,
  title: '',
  body: '',
  icon: 'megaphone',
  type: 'General',
  startDate: '',
  endDate: '',
  active: true,
  panelPosition: 1,
  sortOrder: 0,
  recurringWeekdays: [],
  priority: 'NORMAL',
  displayDuration: 12,
  archived: false,
};

export const blankHadith = {
  id: 0,
  arabic: '',
  translation: '',
  reference: '',
  narrator: '',
  sortOrder: 10,
  active: true,
};

export function blankContent(
  type: ContentType,
  zone: ContentZone,
  priority: ContentItem['priority'] = 'NORMAL',
): ContentItem {
  const timestamp = new Date().toISOString();
  const defaultTitle: Partial<Record<ContentType, string>> = {
    JANAZAH: 'JANAZAH NOTICE',
    NIKAH: 'NIKAH ANNOUNCEMENT',
    SICK_DUA: 'REQUEST FOR DU’A',
    LADIES_TALEEM: 'LADIES TALEEM PROGRAMME',
    EXTERNAL_POSTER: 'COMMUNITY POSTER',
    WHATSAPP_QR: 'JOIN OUR WHATSAPP GROUP',
  };
  return {
    id: 0,
    type,
    displayProfile: defaultDisplayProfileFor(type),
    zone,
    title: defaultTitle[type] ?? '',
    subtitle: '',
    body: '',
    imageUrl: '',
    icon:
      type === 'LIBRARY'
        ? 'book-open'
        : type === 'DONATION'
          ? 'hand-heart'
          : 'megaphone',
    qrUrl: '',
    details: {},
    enabled: true,
    archived: false,
    sortOrder: 10,
    displayDuration: zone === 'MAIN_FEATURE' ? 15 : zone === 'DONATE' ? 20 : 12,
    startAt: '',
    endAt: '',
    recurringWeekdays: [],
    priority,
    takeover: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export async function apiAction(
  entity: string,
  action: string,
  payload?: unknown,
  id?: number,
) {
  const response = await fetch('/api/admin/data', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ entity, action, payload, id }),
  });
  const body = (await response.json()) as { error?: string };
  if (!response.ok)
    throw new Error(body.error ?? 'The change could not be saved.');
}

export function Field({
  label,
  children,
  className = '',
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

export function ToggleField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2.5">
      <Label>{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

export function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  icon: typeof Star;
}) {
  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between text-muted-foreground">
        <span className="text-sm font-medium">{label}</span>
        <Icon className="size-5 text-[#a8842e]" />
      </div>
      <div className="font-heading text-xl font-bold">{value}</div>
    </div>
  );
}

export function StatusBadge({ item }: { item: ContentItem }) {
  const status = contentStatus(item);
  const tone =
    status === 'Active'
      ? 'bg-green-100 text-green-800'
      : status === 'Scheduled'
        ? 'bg-blue-100 text-blue-800'
        : status === 'Expired'
          ? 'bg-amber-100 text-amber-800'
          : 'bg-slate-100 text-slate-700';
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>
      {status.toUpperCase()}
    </span>
  );
}

export { detailFields } from '@/lib/content-details';
