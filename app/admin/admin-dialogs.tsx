'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Eye, ImagePlus, Save, Upload } from 'lucide-react';
import { NoticePreview } from './notice-preview';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { Textarea } from '@/components/ui/textarea';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import {
  type Announcement,
  type ContentItem,
  type ContentType,
  type ContentZone,
  type DisplayState,
  type MediaItem,
  type Programme,
} from '@/lib/masjid-types';

import {
  blankProgramme,
  blankAnnouncement,
  blankContent,
  Field,
  ToggleField,
  detailFields,
} from './admin-shared';

export function ContentDialog({
  draft,
  boardState,
  media,
  onClose,
  onUpload,
  onSave,
}: {
  draft: ContentItem | null;
  boardState: DisplayState;
  media: MediaItem[];
  onClose: () => void;
  onUpload: (file: File) => Promise<string>;
  onSave: (item: ContentItem) => Promise<void>;
}) {
  const [value, setValue] = useState<ContentItem>(
    blankContent('GENERAL_NOTICE', 'IMPORTANT'),
  );
  const [busy, setBusy] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const uploadSequence = useRef(0);
  useEffect(() => {
    if (draft) setValue(draft);
    setPreviewing(false);
    setUploadError('');
    setBusy(false);
    uploadSequence.current += 1;
  }, [draft]);
  async function upload(file?: File) {
    if (!file) return;
    const sequence = ++uploadSequence.current;
    setBusy(true);
    setUploadError('');
    try {
      const url = await onUpload(file);
      if (sequence === uploadSequence.current) {
        setValue((current) => ({ ...current, imageUrl: url, details: {
          ...current.details, posterMimeType: file.type,
        } }));
      }
    } catch (error) {
      if (sequence === uploadSequence.current) setUploadError(error instanceof Error ? error.message : 'Upload failed.');
    } finally {
      if (sequence === uploadSequence.current) setBusy(false);
    }
  }
  const fields = detailFields[value.type] ?? [];
  return (
    <Dialog open={Boolean(draft)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={`max-h-[92vh] overflow-y-auto ${previewing ? 'sm:max-w-6xl' : 'sm:max-w-4xl'}`}>
        <DialogHeader>
          <DialogTitle>
            {value.id ? 'Edit' : 'Create'}{' '}
            {value.type.replaceAll('_', ' ').toLowerCase()}
          </DialogTitle>
          <DialogDescription>
            Structured content, scheduling, priority and zone placement all use
            the live board renderer.
          </DialogDescription>
        </DialogHeader>
        {uploadError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{uploadError}</p>}
        {previewing ? <NoticePreview state={boardState} item={value} /> : <div className="grid gap-4 py-2 md:grid-cols-2">
          <Field label="Content type">
            <Select
              value={value.type}
              disabled={busy}
              onValueChange={(type) => {
                if (!type) return;
                const nextType = type as ContentType;
                const preset: Partial<Record<ContentType, string>> = {
                  JANAZAH: 'JANAZAH NOTICE',
                  NIKAH: 'NIKAH ANNOUNCEMENT',
                  SICK_DUA: 'REQUEST FOR DU’A',
                  LADIES_TALEEM: 'LADIES TALEEM PROGRAMME',
                  EXTERNAL_POSTER: 'COMMUNITY POSTER',
                  WHATSAPP_QR: 'JOIN OUR WHATSAPP GROUP',
                };
                const communityZones: Partial<
                  Record<ContentType, ContentZone>
                > = {
                  JANAZAH: 'JANAZAH',
                  NIKAH: 'NIKAH',
                  SICK_DUA: 'SICK_DUA',
                  LADIES_TALEEM: 'LADIES_TALEEM',
                  EXTERNAL_POSTER: 'COMMUNITY_POSTERS',
                };
                const communityZone = communityZones[nextType];
                setValue({
                  ...value,
                  type: nextType,
                  displayProfile: communityZone ? 'COMMUNITY' : 'MAIN',
                  zone:
                    nextType === 'WHATSAPP_QR'
                      ? 'WHATSAPP_QR'
                      : (communityZone ?? value.zone),
                  title: preset[nextType] ?? value.title,
                });
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[
                  'GENERAL_NOTICE',
                  'JANAZAH',
                  'NIKAH',
                  'SICK_DUA',
                  'LADIES_TALEEM',
                  'EXTERNAL_POSTER',
                  'WHATSAPP_QR',
                  'DONATION',
                  'EMERGENCY',
                ].map((type) => (
                  <SelectItem key={type} value={type}>
                    {type.replaceAll('_', ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Display profile">
            <Select
              value={value.displayProfile}
              onValueChange={(profile) =>
                profile &&
                setValue({
                  ...value,
                  displayProfile: profile as ContentItem['displayProfile'],
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MAIN">Main Masjid Board</SelectItem>
                <SelectItem value="COMMUNITY">Community Board</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Target zone">
            <Select
              value={value.zone}
              onValueChange={(zone) =>
                zone && setValue({ ...value, zone: zone as ContentZone })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[
                  'MAIN_FEATURE',
                  'IMPORTANT',
                  'COMMUNITY',
                  'DONATE',
                  'JANAZAH',
                  'NIKAH',
                  'SICK_DUA',
                  'LADIES_TALEEM',
                  'COMMUNITY_POSTERS',
                  'WHATSAPP_QR',
                ].map((zone) => (
                  <SelectItem key={zone} value={zone}>
                    {zone.replaceAll('_', ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <>
            <Field label="Heading">
              <Input
                value={value.title}
                onChange={(event) =>
                  setValue({ ...value, title: event.target.value })
                }
              />
            </Field>
            <Field label="Subtitle">
              <Input
                value={value.subtitle}
                onChange={(event) =>
                  setValue({ ...value, subtitle: event.target.value })
                }
              />
            </Field>
            <Field label="Body" className="md:col-span-2">
              <Textarea
                rows={4}
                value={value.body}
                onChange={(event) =>
                  setValue({ ...value, body: event.target.value })
                }
              />
            </Field>
          </>
          {fields.map(([key, label, type]) => (
            <Field key={key} label={label}>
              <Input
                type={type}
                value={value.details[key] ?? ''}
                onChange={(event) =>
                  setValue({
                    ...value,
                    details: { ...value.details, [key]: event.target.value },
                  })
                }
              />
            </Field>
          ))}
          <Field label="Priority">
            <Select
              value={value.priority}
              onValueChange={(priority) =>
                priority &&
                setValue({
                  ...value,
                  priority: priority as ContentItem['priority'],
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {['NORMAL', 'IMPORTANT', 'URGENT'].map((priority) => (
                  <SelectItem key={priority} value={priority}>
                    {priority}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Icon">
            <Select
              value={value.icon}
              onValueChange={(icon) => icon && setValue({ ...value, icon })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="megaphone">Megaphone</SelectItem>
                <SelectItem value="users">Community</SelectItem>
                <SelectItem value="book-open">Book</SelectItem>
                <SelectItem value="hand-heart">Giving</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Start showing">
            <Input
              type="datetime-local"
              value={value.startAt}
              onChange={(event) =>
                setValue({ ...value, startAt: event.target.value })
              }
            />
          </Field>
          <Field label="Expiry">
            <Input
              type="datetime-local"
              value={value.endAt}
              onChange={(event) =>
                setValue({ ...value, endAt: event.target.value })
              }
            />
          </Field>
          <Field label="Display duration (seconds)">
            <Input
              type="number"
              min="5"
              max="300"
              value={value.displayDuration}
              onChange={(event) =>
                setValue({
                  ...value,
                  displayDuration: Number(event.target.value),
                })
              }
            />
          </Field>
          <Field label="Sort order">
            <Input
              type="number"
              value={value.sortOrder}
              onChange={(event) =>
                setValue({ ...value, sortOrder: Number(event.target.value) })
              }
            />
          </Field>
          {value.type !== 'SICK_DUA' && (
            <Field label="QR / destination URL">
              <Input
                type="url"
                value={value.qrUrl}
                onChange={(event) =>
                  setValue({ ...value, qrUrl: event.target.value })
                }
              />
            </Field>
          )}
          {value.type !== 'SICK_DUA' && (
            <Field label="Image">
              <div className="flex gap-2">
                <Select
                  value={value.imageUrl || 'none'}
                  disabled={busy}
                  onValueChange={(url) => {
                    if (!url) return;
                    const selected = media.find((item) => item.url === url);
                    setValue({
                      ...value,
                      imageUrl: url === 'none' ? '' : url,
                      details: {
                        ...value.details,
                        posterMimeType:
                          url === 'none' ? '' : (selected?.mimeType ?? ''),
                      },
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No image</SelectItem>
                    {media
                      .filter((item) =>
                        value.type === 'EXTERNAL_POSTER'
                          ? [
                              'image/jpeg',
                              'image/png',
                              'image/webp',
                              'application/pdf',
                            ].includes(item.mimeType)
                          : item.mimeType.startsWith('image/'),
                      )
                      .map((item) => (
                        <SelectItem key={item.id} value={item.url}>
                          {item.filename}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <label className="cursor-pointer rounded-md border px-3 py-2 text-sm">
                  <Upload className="inline size-4" />
                  <input
                    type="file"
                    className="sr-only"
                    aria-label="Upload notice image or PDF"
                    disabled={busy}
                    accept={
                      value.type === 'EXTERNAL_POSTER'
                        ? 'image/png,image/jpeg,image/webp,application/pdf'
                        : 'image/png,image/jpeg,image/webp'
                    }
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      void upload(file);
                      event.target.value = '';
                    }}
                  />
                </label>
              </div>
            </Field>
          )}
          <Field label="Recurring weekdays" className="md:col-span-2">
            <div className="flex flex-wrap gap-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(
                (day, index) => (
                  <label
                    key={day}
                    className={`cursor-pointer rounded-md border px-3 py-2 text-sm ${value.recurringWeekdays.includes(index) ? 'border-[#b69747] bg-[#f6efd9]' : ''}`}
                  >
                    <input
                      className="sr-only"
                      type="checkbox"
                      checked={value.recurringWeekdays.includes(index)}
                      onChange={(event) =>
                        setValue({
                          ...value,
                          recurringWeekdays: event.target.checked
                            ? [...value.recurringWeekdays, index].sort(
                                (a, b) => a - b,
                              )
                            : value.recurringWeekdays.filter(
                                (entry) => entry !== index,
                              ),
                        })
                      }
                    />
                    {day}
                  </label>
                ),
              )}
            </div>
          </Field>
          <div className="grid gap-3 md:col-span-2 sm:grid-cols-3">
            <ToggleField
              label="Enabled"
              checked={value.enabled}
              onChange={(enabled) => setValue({ ...value, enabled })}
            />
            <ToggleField
              label="Archived"
              checked={value.archived}
              onChange={(archived) => setValue({ ...value, archived })}
            />
            <ToggleField
              label="Urgent full-board takeover"
              checked={value.takeover}
              onChange={(takeover) =>
                setValue({
                  ...value,
                  takeover,
                  priority: takeover ? 'URGENT' : value.priority,
                })
              }
            />
          </div>
          {value.type === 'JANAZAH' && !value.endAt && (
            <p className="md:col-span-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              Without an explicit expiry, this announcement expires
              automatically six hours after the burial or Janazah time.
            </p>
          )}
        </div>}
        <DialogFooter>
          {previewing ? <Button variant="outline" onClick={() => setPreviewing(false)}><ArrowLeft /> Back to editing</Button>
            : <Button variant="outline" onClick={onClose}>Cancel</Button>}
          {!previewing && <Button variant="outline" disabled={busy} onClick={() => setPreviewing(true)}><Eye /> Preview on TV</Button>}
          <Button
            disabled={!value.title.trim() || busy}
            onClick={() => void onSave(value).catch(() => undefined)}
          >
            <Save /> Save item
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function UserDialog({
  draft,
  onClose,
  onSave,
}: {
  draft: {
    id?: number;
    username: string;
    password: string;
    role: 'admin' | 'editor';
    active: boolean;
    root?: boolean;
  } | null;
  onClose: () => void;
  onSave: (user: {
    id?: number;
    username: string;
    password: string;
    role: 'admin' | 'editor';
    active: boolean;
  }) => Promise<void>;
}) {
  const [value, setValue] = useState<{
    id?: number;
    username: string;
    password: string;
    role: 'admin' | 'editor';
    active: boolean;
    root?: boolean;
  }>({ username: '', password: '', role: 'editor', active: true });
  useEffect(() => {
    if (draft) setValue(draft);
  }, [draft]);
  const protectedAccount = Boolean(value.id && value.root);
  return (
    <Dialog open={Boolean(draft)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{value.id ? 'Edit user' : 'Add user'}</DialogTitle>
          <DialogDescription>
            Use a unique account for every person who manages the board.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {protectedAccount && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              This is the primary administrator account. The username, role and
              active state are protected; the password can be changed here.
            </p>
          )}
          <Field label="Username">
            <Input
              value={value.username}
              disabled={protectedAccount}
              onChange={(event) =>
                setValue({ ...value, username: event.target.value })
              }
            />
          </Field>
          <Field
            label={
              value.id
                ? 'New password (leave blank to keep current)'
                : 'Password'
            }
          >
            <Input
              type="password"
              value={value.password}
              onChange={(event) =>
                setValue({ ...value, password: event.target.value })
              }
            />
          </Field>
          <Field label="Role">
            <Select
              value={value.role}
              disabled={protectedAccount}
              onValueChange={(role) =>
                role && setValue({ ...value, role: role as 'admin' | 'editor' })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Administrator</SelectItem>
                <SelectItem value="editor">Editor</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <ToggleField
            label="Active"
            checked={value.active}
            onChange={(active) =>
              !protectedAccount && setValue({ ...value, active })
            }
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={
              !value.username.trim() || (!value.id && value.password.length < 8)
            }
            onClick={() => void onSave(value).catch(() => undefined)}
          >
            <Save /> Save user
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ProgrammeDialog({
  draft,
  media,
  onClose,
  onUpload,
  onSave,
}: {
  draft: Programme | null;
  media: MediaItem[];
  onClose: () => void;
  onUpload: (f: File) => Promise<string>;
  onSave: (p: Programme) => Promise<void>;
}) {
  const [value, setValue] = useState<Programme>(blankProgramme);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (draft) setValue(draft);
  }, [draft]);
  async function upload(file?: File) {
    if (!file) return;
    setBusy(true);
    try {
      const url = await onUpload(file);
      setValue((v) => ({ ...v, imageUrl: url }));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open={Boolean(draft)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            {value.id ? 'Edit programme' : 'Create programme'}
          </DialogTitle>
          <DialogDescription>
            Programme details are used in the featured area and upcoming list.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2 md:grid-cols-2">
          <Field label="Title">
            <Input
              required
              value={value.title}
              onChange={(e) => setValue({ ...value, title: e.target.value })}
            />
          </Field>
          <Field label="Subtitle">
            <Input
              value={value.subtitle}
              onChange={(e) => setValue({ ...value, subtitle: e.target.value })}
            />
          </Field>
          <Field label="Category">
            <Input
              value={value.category}
              onChange={(e) => setValue({ ...value, category: e.target.value })}
            />
          </Field>
          <Field label="Date or frequency">
            <Input
              value={value.dateText}
              onChange={(e) => setValue({ ...value, dateText: e.target.value })}
            />
          </Field>
          <Field label="Start time">
            <Input
              value={value.startTime}
              onChange={(e) =>
                setValue({ ...value, startTime: e.target.value })
              }
            />
          </Field>
          <Field label="End time">
            <Input
              value={value.endTime}
              onChange={(e) => setValue({ ...value, endTime: e.target.value })}
            />
          </Field>
          <Field label="Venue">
            <Input
              value={value.venue}
              onChange={(e) => setValue({ ...value, venue: e.target.value })}
            />
          </Field>
          <Field label="Audience">
            <Input
              value={value.audience}
              onChange={(e) => setValue({ ...value, audience: e.target.value })}
            />
          </Field>
          <Field label="Speaker (optional)">
            <Input
              value={value.speaker}
              onChange={(e) => setValue({ ...value, speaker: e.target.value })}
            />
          </Field>
          <Field label="Description" className="md:col-span-2">
            <Textarea
              rows={4}
              value={value.description}
              onChange={(e) =>
                setValue({ ...value, description: e.target.value })
              }
            />
          </Field>
          <Field label="Quote" className="md:col-span-2">
            <Textarea
              value={value.quote}
              onChange={(e) => setValue({ ...value, quote: e.target.value })}
            />
          </Field>
          <Field label="Quote source">
            <Input
              value={value.quoteSource}
              onChange={(e) =>
                setValue({ ...value, quoteSource: e.target.value })
              }
            />
          </Field>
          <Field label="Event starts">
            <Input
              type="datetime-local"
              value={value.eventStart}
              onChange={(e) =>
                setValue({ ...value, eventStart: e.target.value })
              }
            />
          </Field>
          <Field label="Event ends">
            <Input
              type="datetime-local"
              value={value.eventEnd}
              min={value.eventStart || undefined}
              onChange={(e) => setValue({ ...value, eventEnd: e.target.value })}
            />
          </Field>
          <p className="md:col-span-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">
            An upcoming programme moves to the main feature on its event day. It
            is removed after Event ends, or at the end of that day when no end
            time is supplied.
          </p>
          <Field label="Sort order">
            <Input
              type="number"
              value={value.sortOrder}
              onChange={(e) =>
                setValue({ ...value, sortOrder: Number(e.target.value) })
              }
            />
          </Field>
          <Field label="Priority">
            <Select
              value={value.priority}
              onValueChange={(priority) =>
                priority &&
                setValue({
                  ...value,
                  priority: priority as Programme['priority'],
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {['NORMAL', 'IMPORTANT', 'URGENT'].map((priority) => (
                  <SelectItem key={priority} value={priority}>
                    {priority}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Display duration (seconds)">
            <Input
              type="number"
              min="5"
              max="300"
              value={value.displayDuration}
              onChange={(e) =>
                setValue({ ...value, displayDuration: Number(e.target.value) })
              }
            />
          </Field>
          <Field label="Display from">
            <Input
              type="datetime-local"
              value={value.displayFrom}
              onChange={(e) =>
                setValue({ ...value, displayFrom: e.target.value })
              }
            />
          </Field>
          <Field label="Display until">
            <Input
              type="datetime-local"
              value={value.displayUntil}
              onChange={(e) =>
                setValue({ ...value, displayUntil: e.target.value })
              }
            />
          </Field>
          <Field label="Programme image" className="md:col-span-2">
            <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
              <img
                src={value.imageUrl || '/assets/masjid-sunset.webp'}
                alt="Programme preview"
                className="aspect-video w-full rounded-lg object-cover"
              />
              <div className="space-y-3">
                <Select
                  value={value.imageUrl || 'none'}
                  onValueChange={(v) =>
                    v && setValue({ ...value, imageUrl: v === 'none' ? '' : v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No uploaded image</SelectItem>
                    {media
                      .filter((m) => m.mimeType.startsWith('image/'))
                      .map((m) => (
                        <SelectItem key={m.id} value={m.url}>
                          {m.filename}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed p-3 text-sm font-medium">
                  <ImagePlus className="size-4" />{' '}
                  {busy ? 'Uploading…' : 'Upload a new image'}
                  <input
                    className="sr-only"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => void upload(e.target.files?.[0])}
                  />
                </label>
              </div>
            </div>
          </Field>
          <Field label="Recurring weekdays" className="md:col-span-2">
            <div className="flex flex-wrap gap-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(
                (day, index) => (
                  <label
                    key={day}
                    className={`cursor-pointer rounded-md border px-3 py-2 text-sm ${value.recurringWeekdays.includes(index) ? 'border-[#b69747] bg-[#f6efd9]' : ''}`}
                  >
                    <input
                      className="sr-only"
                      type="checkbox"
                      checked={value.recurringWeekdays.includes(index)}
                      onChange={(event) =>
                        setValue({
                          ...value,
                          recurringWeekdays: event.target.checked
                            ? [...value.recurringWeekdays, index].sort(
                                (a, b) => a - b,
                              )
                            : value.recurringWeekdays.filter(
                                (entry) => entry !== index,
                              ),
                        })
                      }
                    />
                    {day}
                  </label>
                ),
              )}
            </div>
          </Field>
          <div className="grid gap-3 md:col-span-2 sm:grid-cols-3">
            <ToggleField
              label="Active"
              checked={value.active}
              onChange={(v) => setValue({ ...value, active: v })}
            />
            <ToggleField
              label="Show upcoming"
              checked={value.showUpcoming}
              onChange={(v) => setValue({ ...value, showUpcoming: v })}
            />
            <ToggleField
              label="Set as featured"
              checked={value.featured}
              onChange={(v) => setValue({ ...value, featured: v })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!value.title.trim() || busy}
            onClick={() => onSave(value)}
          >
            <Save /> Save programme
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AnnouncementDialog({
  draft,
  onClose,
  onSave,
}: {
  draft: Announcement | null;
  onClose: () => void;
  onSave: (a: Announcement) => Promise<void>;
}) {
  const [value, setValue] = useState<Announcement>(blankAnnouncement);
  useEffect(() => {
    if (draft) setValue(draft);
  }, [draft]);
  return (
    <Dialog open={Boolean(draft)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {value.id ? 'Edit announcement' : 'Add announcement'}
          </DialogTitle>
          <DialogDescription>
            Choose where and when this lower panel appears.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2 md:grid-cols-2">
          <Field label="Title">
            <Input
              value={value.title}
              onChange={(e) => setValue({ ...value, title: e.target.value })}
            />
          </Field>
          <Field label="Type">
            <Select
              value={value.type}
              onValueChange={(v) => v && setValue({ ...value, type: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[
                  'Important Notice',
                  'Community Announcement',
                  'Library',
                  'General',
                  'Emergency',
                ].map((v) => (
                  <SelectItem value={v} key={v}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Body" className="md:col-span-2">
            <Textarea
              rows={5}
              value={value.body}
              onChange={(e) => setValue({ ...value, body: e.target.value })}
            />
          </Field>
          <Field label="Icon">
            <Select
              value={value.icon}
              onValueChange={(v) => v && setValue({ ...value, icon: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="megaphone">Megaphone</SelectItem>
                <SelectItem value="users">Community</SelectItem>
                <SelectItem value="book-open">Book</SelectItem>
                <SelectItem value="hand-heart">Giving</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Panel position">
            <Input
              type="number"
              min="1"
              max="3"
              value={value.panelPosition}
              onChange={(e) =>
                setValue({ ...value, panelPosition: Number(e.target.value) })
              }
            />
          </Field>
          <Field label="Start date">
            <Input
              type="datetime-local"
              value={value.startDate}
              onChange={(e) =>
                setValue({ ...value, startDate: e.target.value })
              }
            />
          </Field>
          <Field label="End date">
            <Input
              type="datetime-local"
              value={value.endDate}
              onChange={(e) => setValue({ ...value, endDate: e.target.value })}
            />
          </Field>
          <ToggleField
            label="Active"
            checked={value.active}
            onChange={(v) => setValue({ ...value, active: v })}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!value.title.trim()} onClick={() => onSave(value)}>
            <Save /> Save announcement
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export type HadithDraft = {
  id?: number;
  arabic: string;
  translation: string;
  reference: string;
  narrator: string;
  sortOrder: number;
  active: boolean;
};

export function HadithDialog({
  draft,
  onClose,
  onSave,
}: {
  draft: HadithDraft | null;
  onClose: () => void;
  onSave: (hadith: HadithDraft) => Promise<void>;
}) {
  const [value, setValue] = useState<HadithDraft>({
    arabic: '',
    translation: '',
    reference: '',
    narrator: '',
    sortOrder: 10,
    active: true,
  });
  useEffect(() => {
    if (draft) setValue(draft);
  }, [draft]);
  const complete =
    Boolean(value.arabic.trim()) &&
    Boolean(value.translation.trim()) &&
    Boolean(value.reference.trim());
  return (
    <Dialog open={Boolean(draft)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{value.id ? 'Edit hadith' : 'Add hadith'}</DialogTitle>
          <DialogDescription>
            The bottom bar shows the Arabic with the translation and reference.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <Field label="Arabic text">
            <Textarea
              dir="rtl"
              rows={4}
              maxLength={2000}
              className="font-[family-name:var(--font-amiri)] text-lg"
              value={value.arabic}
              onChange={(e) => setValue({ ...value, arabic: e.target.value })}
            />
          </Field>
          <Field label="Translation">
            <Textarea
              rows={3}
              maxLength={2000}
              value={value.translation}
              onChange={(e) =>
                setValue({ ...value, translation: e.target.value })
              }
            />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Reference">
              <Input
                maxLength={160}
                placeholder="Sahih al-Bukhari 1"
                value={value.reference}
                onChange={(e) =>
                  setValue({ ...value, reference: e.target.value })
                }
              />
            </Field>
            <Field label="Narrator (optional)">
              <Input
                maxLength={120}
                value={value.narrator}
                onChange={(e) =>
                  setValue({ ...value, narrator: e.target.value })
                }
              />
            </Field>
          </div>
          <ToggleField
            label="Active"
            checked={value.active}
            onChange={(v) => setValue({ ...value, active: v })}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!complete} onClick={() => void onSave(value)}>
            <Save /> Save hadith
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
