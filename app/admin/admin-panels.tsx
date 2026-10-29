'use client';

import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Megaphone,
  MonitorPlay,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  ShieldCheck,
  Star,
  Trash2,
  Upload,
  Users,
  Archive,
  Copy,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
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
  FONT_OPTIONS,
  type Announcement,
  type ContentItem,
  type DisplayState,
  type DonationSettings,
  type HadithEntry,
  type IslamicDateState,
  type MediaItem,
  type Programme,
  type Settings,
  type UserSummary,
} from '@/lib/masjid-types';

import { Field, ToggleField, StatusBadge } from './admin-shared';
import { AdminActionButton, AdminActionLink } from './admin-action';
import { PosterThumbnail } from '@/components/poster-thumbnail';
import { NoticePreviewDialog } from './notice-preview';

export function PreviewPanel() {
  return (
    <section>
      <div className="mb-5">
        <div>
          <h2 className="font-heading text-2xl font-bold">
            Live display previews
          </h2>
          <p className="text-muted-foreground">
            These are the same responsive routes used by the two display
            screens.
          </p>
        </div>
      </div>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.42fr)]">
        <article>
          <div className="mb-3 flex items-center justify-between">
            <strong>Main Masjid Board · 16:9</strong>
            <a
              className={buttonVariants({ variant: 'outline' })}
              href="/display/main"
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink className="size-4" /> Full screen
            </a>
          </div>
          <div className="aspect-video overflow-hidden rounded-xl border-[6px] border-[#171c22] bg-black shadow-2xl">
            <iframe
              title="Main Masjid Board preview"
              src="/display/main"
              className="h-full w-full border-0"
            />
          </div>
        </article>
        <article>
          <div className="mb-3 flex items-center justify-between">
            <strong>Community Board · 9:16</strong>
            <a
              className={buttonVariants({ variant: 'outline' })}
              href="/display/community"
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink className="size-4" /> Full screen
            </a>
          </div>
          <div className="mx-auto aspect-[9/16] w-full max-w-[430px] overflow-hidden rounded-xl border-[6px] border-[#171c22] bg-black shadow-2xl">
            <iframe
              title="Community Notice Board preview"
              src="/display/community"
              className="h-full w-full border-0"
            />
          </div>
        </article>
      </div>
    </section>
  );
}

export function FeaturedPanel({
  state,
  onPublish,
}: {
  state: DisplayState;
  onPublish: (id: number) => Promise<void>;
}) {
  const current = state.programmes.find((p) => p.featured);
  const [selected, setSelected] = useState(
    String(current?.id ?? state.programmes[0]?.id ?? ''),
  );
  return (
    <section className="max-w-4xl">
      <h2 className="font-heading text-2xl font-bold">
        Choose the featured programme
      </h2>
      <p className="mb-6 text-muted-foreground">
        Publishing adds this programme to the rotating main feature zone.
      </p>
      <div className="rounded-xl border bg-white p-6">
        <Field label="Current featured programme">
          <Select
            value={selected}
            onValueChange={(value) => value && setSelected(value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Choose a programme" />
            </SelectTrigger>
            <SelectContent>
              {state.programmes.map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>
                  {p.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        {selected && (
          <div className="mt-5 grid gap-5 rounded-xl bg-muted p-5 sm:grid-cols-[180px_1fr]">
            <img
              src={
                state.programmes.find((p) => String(p.id) === selected)
                  ?.imageUrl || '/assets/quran-circle.webp'
              }
              alt=""
              className="aspect-video w-full rounded-lg object-cover"
            />
            <div>
              <span className="text-xs font-bold tracking-widest text-[#947324]">
                {
                  state.programmes.find((p) => String(p.id) === selected)
                    ?.category
                }
              </span>
              <h3 className="font-heading mt-2 text-2xl font-bold">
                {state.programmes.find((p) => String(p.id) === selected)?.title}
              </h3>
              <p>
                {
                  state.programmes.find((p) => String(p.id) === selected)
                    ?.dateText
                }
              </p>
            </div>
          </div>
        )}
        <Button
          className="mt-5 bg-[#b69747] text-[#0c1118]"
          onClick={() => onPublish(Number(selected))}
        >
          <Star /> Publish as featured
        </Button>
      </div>
    </section>
  );
}

export function ProgrammesPanel({
  programmes,
  onAdd,
  onEdit,
  onDelete,
  onMove,
  onDuplicate,
  onToggle,
  onArchive,
}: {
  programmes: Programme[];
  onAdd: () => void;
  onEdit: (p: Programme) => void;
  onDelete: (p: Programme) => void;
  onMove: (p: Programme, d: -1 | 1) => void;
  onDuplicate: (p: Programme) => void;
  onToggle: (p: Programme) => Promise<void>;
  onArchive: (p: Programme) => Promise<void>;
}) {
  const ordered = [...programmes].sort((a, b) => a.sortOrder - b.sortOrder);
  return (
    <section>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="font-heading text-2xl font-bold">Programmes</h2>
          <p className="text-muted-foreground">
            Create, schedule and order display programmes.
          </p>
        </div>
        <Button onClick={onAdd}>
          <Plus /> Create programme
        </Button>
      </div>
      <div className="overflow-hidden rounded-xl border bg-white">
        <div className="hidden grid-cols-[72px_1fr_150px_120px_220px] gap-4 border-b bg-muted/50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground md:grid">
          <span>Order</span>
          <span>Programme</span>
          <span>Display</span>
          <span>Status</span>
          <span>Actions</span>
        </div>
        {ordered.map((p, index) => (
          <div
            key={p.id}
            className="grid items-center gap-4 border-b p-4 last:border-b-0 md:grid-cols-[72px_1fr_150px_120px_220px]"
          >
            <div className="flex">
              <AdminActionButton hint="Move earlier"
                size="icon-sm"
                variant="ghost"
                disabled={index === 0}
                onClick={() => onMove(p, -1)}
                aria-label="Move up"
              >
                <ChevronUp />
              </AdminActionButton>
              <AdminActionButton hint="Move later"
                size="icon-sm"
                variant="ghost"
                disabled={index === ordered.length - 1}
                onClick={() => onMove(p, 1)}
                aria-label="Move down"
              >
                <ChevronDown />
              </AdminActionButton>
            </div>
            <div className="flex min-w-0 items-center gap-3">
              <img
                src={p.imageUrl || '/assets/masjid-sunset.webp'}
                alt=""
                className="h-14 w-20 rounded-md object-cover"
              />
              <div className="min-w-0">
                <div className="truncate font-heading font-bold">{p.title}</div>
                <div className="truncate text-sm text-muted-foreground">
                  {p.subtitle || p.dateText}
                </div>
              </div>
            </div>
            <div className="text-sm">
              {p.featured ? (
                <span className="font-semibold text-[#8b6b1f]">Featured</span>
              ) : p.showUpcoming ? (
                'Upcoming'
              ) : (
                'Hidden from list'
              )}
            </div>
            <div>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${p.active && !p.archived ? 'bg-green-100 text-green-800' : 'bg-zinc-100 text-zinc-500'}`}
              >
                {p.archived ? 'Archived' : p.active ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div className="flex gap-1">
              <AdminActionButton hint="Edit programme"
                size="icon-sm"
                variant="ghost"
                onClick={() => onEdit(p)}
                aria-label={`Edit ${p.title}`}
              >
                <Pencil />
              </AdminActionButton>
              <AdminActionButton hint="Make a copy"
                size="icon-sm"
                variant="ghost"
                onClick={() => onDuplicate(p)}
                aria-label={`Duplicate ${p.title}`}
              >
                <Copy />
              </AdminActionButton>
              <AdminActionButton hint={p.active ? 'Pause on TV' : 'Enable on TV'}
                size="icon-sm"
                variant="ghost"
                onClick={() => void onToggle(p)}
                aria-label={p.active ? `Pause ${p.title}` : `Enable ${p.title}`}
              >
                <MonitorPlay />
              </AdminActionButton>
              <AdminActionButton hint={p.archived ? 'Restore from archive' : 'Archive programme'}
                size="icon-sm"
                variant="ghost"
                onClick={() => void onArchive(p)}
                aria-label={`${p.archived ? 'Restore' : 'Archive'} ${p.title}`}
              >
                <Archive />
              </AdminActionButton>
              <AdminActionButton hint="Delete programme"
                size="icon-sm"
                variant="ghost"
                onClick={() => onDelete(p)}
                aria-label={`Delete ${p.title}`}
                className="text-red-700"
              >
                <Trash2 />
              </AdminActionButton>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function AnnouncementsPanel({
  announcements,
  onAdd,
  onEdit,
  onDelete,
  title = 'Announcements',
  description = 'Manage the three lower information panels.',
  addLabel = 'Add announcement',
}: {
  announcements: Announcement[];
  onAdd: () => void;
  onEdit: (a: Announcement) => void;
  onDelete: (a: Announcement) => void;
  title?: string;
  description?: string;
  addLabel?: string;
}) {
  return (
    <section>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="font-heading text-2xl font-bold">{title}</h2>
          <p className="text-muted-foreground">{description}</p>
        </div>
        <Button onClick={onAdd}>
          <Plus /> {addLabel}
        </Button>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {announcements.map((a) => (
          <article
            key={a.id}
            className="rounded-xl border bg-white p-5 shadow-sm"
          >
            <div className="mb-4 flex items-start justify-between">
              <div className="grid size-11 place-items-center rounded-lg bg-[#eee7d8] text-[#8b6b1f]">
                {a.icon === 'users' ? (
                  <Users />
                ) : a.icon === 'book-open' ? (
                  <BookOpen />
                ) : (
                  <Megaphone />
                )}
              </div>
              <span className="rounded-full bg-muted px-2.5 py-1 text-xs">
                Panel {a.panelPosition}
              </span>
            </div>
            <h3 className="font-heading font-bold">{a.title}</h3>
            <p className="mt-2 min-h-20 whitespace-pre-line text-sm text-muted-foreground">
              {a.body}
            </p>
            <div className="mt-4 flex gap-2">
              <Button size="sm" variant="outline" onClick={() => onEdit(a)}>
                <Pencil /> Edit
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-red-700"
                onClick={() => onDelete(a)}
              >
                <Trash2 /> Delete
              </Button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function EmergencyPanel({
  settings,
  onSave,
}: {
  settings: Settings;
  onSave: (s: Settings) => Promise<void>;
}) {
  const [draft, setDraft] = useState(settings);
  useEffect(() => setDraft(settings), [settings]);
  return (
    <section className="max-w-3xl">
      <div
        className={`mb-6 rounded-xl p-5 text-center font-heading text-xl font-bold text-white ${draft.emergencyTheme === 'red' ? 'bg-red-800' : draft.emergencyTheme === 'gold' ? 'bg-[#9a761f]' : 'bg-[#0c1118]'}`}
      >
        {draft.emergencyMessage || 'Emergency message preview'}
      </div>
      <div className="space-y-5 rounded-xl border bg-white p-6">
        <ToggleField
          label="Show emergency message"
          checked={draft.emergencyEnabled}
          onChange={(v) => setDraft({ ...draft, emergencyEnabled: v })}
        />
        <Field label="Message">
          <Textarea
            value={draft.emergencyMessage}
            onChange={(e) =>
              setDraft({ ...draft, emergencyMessage: e.target.value })
            }
            rows={3}
          />
        </Field>
        <Field label="Colour theme">
          <Select
            value={draft.emergencyTheme}
            onValueChange={(v) =>
              v && setDraft({ ...draft, emergencyTheme: v })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="red">Red</SelectItem>
              <SelectItem value="gold">Gold</SelectItem>
              <SelectItem value="black">Black</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Button onClick={() => onSave(draft)}>
          <Save /> Publish emergency notice
        </Button>
      </div>
    </section>
  );
}

export function DonationPanel({
  donation,
  media,
  onSave,
}: {
  donation: DonationSettings;
  media: MediaItem[];
  onSave: (d: DonationSettings) => Promise<void>;
}) {
  const [draft, setDraft] = useState(donation);
  useEffect(() => setDraft(donation), [donation]);
  return (
    <section className="max-w-3xl">
      <div className="space-y-5 rounded-xl border bg-white p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Panel title">
            <Input
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
          </Field>
          <Field label="Donation URL (generates QR)">
            <Input
              type="url"
              value={draft.qrUrl}
              onChange={(e) => setDraft({ ...draft, qrUrl: e.target.value })}
            />
          </Field>
        </div>
        <Field label="Main text">
          <Textarea
            value={draft.body}
            onChange={(e) => setDraft({ ...draft, body: e.target.value })}
          />
        </Field>
        <Field label="Small note">
          <Textarea
            value={draft.note}
            onChange={(e) => setDraft({ ...draft, note: e.target.value })}
          />
        </Field>
        <Field label="Or use an uploaded QR image">
          <Select
            value={draft.qrImageUrl || 'generated'}
            onValueChange={(v) =>
              v &&
              setDraft({ ...draft, qrImageUrl: v === 'generated' ? '' : v })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="generated">Generate from URL</SelectItem>
              {media
                .filter((m) => m.mimeType.startsWith('image/'))
                .map((m) => (
                  <SelectItem value={m.url} key={m.id}>
                    {m.filename}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </Field>
        <Button onClick={() => onSave(draft)}>
          <Save /> Publish donation panel
        </Button>
      </div>
    </section>
  );
}

function MediaViewer({
  item,
  onClose,
}: {
  item: MediaItem | null;
  onClose: () => void;
}) {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const zoomRef = useRef(1);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(
    null,
  );
  const stage = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!item) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [item, onClose]);

  useEffect(() => {
    const element = stage.current;
    if (!element || !item) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const factor = event.deltaY < 0 ? 1.15 : 1 / 1.15;
      const next = Math.min(8, Math.max(1, zoomRef.current * factor));
      zoomRef.current = next;
      setZoom(next);
      if (next === 1) setOffset({ x: 0, y: 0 });
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, [item]);

  if (!item) return <Dialog open={false} onOpenChange={() => undefined} />;
  const isPdf = item.mimeType === 'application/pdf';

  function zoomTo(value: number) {
    const next = Math.min(8, Math.max(1, value));
    zoomRef.current = next;
    setZoom(next);
    if (next === 1) setOffset({ x: 0, y: 0 });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="flex h-[min(88vh,900px)] max-w-none flex-col gap-3 p-4 sm:max-w-[min(1400px,calc(100vw-2rem))]"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">
              {item.filename}
            </div>
            <div className="text-xs text-muted-foreground">
              {(item.size / 1024 / 1024).toFixed(1)} MB
            </div>
          </div>
          <div className="flex items-center gap-1">
            <AdminActionButton hint="Zoom out"
              size="icon-sm"
              variant="ghost"
              onClick={() => zoomTo(zoom - 0.5)}
              aria-label="Zoom out"
            >
              <ZoomOut />
            </AdminActionButton>
            <span className="w-12 text-center text-xs">
              {Math.round(zoom * 100)}%
            </span>
            <AdminActionButton hint="Zoom in"
              size="icon-sm"
              variant="ghost"
              onClick={() => zoomTo(zoom + 0.5)}
              aria-label="Zoom in"
            >
              <ZoomIn />
            </AdminActionButton>
            <AdminActionButton hint="Reset zoom"
              size="icon-sm"
              variant="ghost"
              onClick={() => zoomTo(1)}
              aria-label="Reset zoom"
            >
              <RotateCcw />
            </AdminActionButton>
            <AdminActionLink hint="Download file"
              href={item.url}
              download={item.filename}
              className={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}
              aria-label={`Download ${item.filename}`}
            >
              <Download />
            </AdminActionLink>
            <AdminActionButton hint="Close preview"
              size="icon-sm"
              variant="ghost"
              onClick={onClose}
              aria-label="Close preview"
            >
              <X />
            </AdminActionButton>
          </div>
        </div>
        <div
          ref={stage}
          className="relative grid min-h-0 flex-1 place-items-center overflow-hidden rounded-lg bg-[#0c1118]"
          onDoubleClick={() => !isPdf && zoomTo(zoom === 1 ? 2.5 : 1)}
          onPointerDown={(event) => {
            if (isPdf || zoom <= 1) return;
            drag.current = {
              x: event.clientX,
              y: event.clientY,
              ox: offset.x,
              oy: offset.y,
            };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (!drag.current) return;
            setOffset({
              x: drag.current.ox + (event.clientX - drag.current.x),
              y: drag.current.oy + (event.clientY - drag.current.y),
            });
          }}
          onPointerUp={() => {
            drag.current = null;
          }}
          onPointerCancel={() => {
            drag.current = null;
          }}
        >
          {isPdf ? (
            <iframe
              src={item.url}
              title={item.filename}
              className="size-full bg-white"
            />
          ) : (
            <img
              src={item.url}
              alt={item.filename}
              draggable={false}
              className={`max-h-full max-w-full select-none object-contain ${zoom > 1 ? 'cursor-grab active:cursor-grabbing' : ''}`}
              style={{
                transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
              }}
            />
          )}
        </div>
        <div className="text-center text-xs text-muted-foreground">
          {isPdf
            ? 'Preview rendered by your browser.'
            : 'Scroll to zoom · Drag to pan · Double-click to fit'}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function MediaPanel({
  media,
  onUpload,
  onRename,
  onDelete,
}: {
  media: MediaItem[];
  onUpload: (f: File) => Promise<string>;
  onRename: (m: MediaItem, filename: string) => Promise<void>;
  onDelete: (m: MediaItem) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [viewing, setViewing] = useState<MediaItem | null>(null);
  const [renaming, setRenaming] = useState<MediaItem | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [savingRename, setSavingRename] = useState(false);
  async function handle(file?: File) {
    if (!file) return;
    setBusy(true);
    try {
      await onUpload(file);
    } finally {
      setBusy(false);
    }
  }
  function drop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    void handle(event.dataTransfer.files[0]);
  }
  async function submitRename() {
    if (!renaming) return;
    setSavingRename(true);
    try {
      await onRename(renaming, renameValue);
      setRenaming(null);
    } catch {
      /* the parent surfaces the error */
    } finally {
      setSavingRename(false);
    }
  }
  return (
    <section>
      {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- drag-and-drop is a pointer enhancement; the nested file input is the accessible control */}
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={drop}
        className={`mb-6 grid cursor-pointer place-items-center rounded-xl border-2 border-dashed p-10 text-center transition ${dragging ? 'border-[#b69747] bg-[#eee7d8]' : 'border-muted-foreground/30 bg-white'}`}
      >
        <Upload className="mb-3 size-8 text-[#a8842e]" />
        <strong>
          {busy ? 'Uploading…' : 'Drop an image here or click to browse'}
        </strong>
        <span className="mt-1 text-sm text-muted-foreground">
          JPG, JPEG, PNG, WEBP or PDF — maximum 20 MB
        </span>
        <input
          className="sr-only"
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          disabled={busy}
          onChange={(e) => void handle(e.target.files?.[0])}
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {media.map((m) => (
          <article
            key={m.id}
            className="overflow-hidden rounded-xl border bg-white"
          >
            <button
              type="button"
              onClick={() => setViewing(m)}
              className="block w-full cursor-zoom-in"
              aria-label={`Preview ${m.filename}`}
            >
              {m.mimeType === 'application/pdf' ? (
                <div className="grid aspect-video place-items-center bg-muted text-muted-foreground">
                  <FileText className="size-10" />
                  <span className="sr-only">PDF file</span>
                </div>
              ) : (
                <img
                  src={m.url}
                  alt={m.filename}
                  className="aspect-video w-full bg-muted object-cover"
                />
              )}
            </button>
            <div className="flex items-center justify-between gap-2 p-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">
                  {m.filename}
                </div>
                <div className="text-xs text-muted-foreground">
                  {(m.size / 1024 / 1024).toFixed(1)} MB
                </div>
              </div>
              <div className="flex gap-1">
                <AdminActionButton hint="Rename file"
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => {
                    setRenaming(m);
                    setRenameValue(m.filename);
                  }}
                  aria-label={`Rename ${m.filename}`}
                >
                  <Pencil />
                </AdminActionButton>
                <AdminActionLink hint="Download file"
                  href={m.url}
                  download={m.filename}
                  className={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}
                  aria-label={`Download ${m.filename}`}
                >
                  <Download />
                </AdminActionLink>
                <AdminActionButton hint="Delete file"
                  size="icon-sm"
                  variant="ghost"
                  className="text-red-700"
                  onClick={() => onDelete(m)}
                  aria-label={`Delete ${m.filename}`}
                >
                  <Trash2 />
                </AdminActionButton>
              </div>
            </div>
          </article>
        ))}
      </div>
      {!media.length && (
        <p className="text-center text-muted-foreground">
          Uploaded images will appear here.
        </p>
      )}
      <MediaViewer
        key={viewing?.id ?? 'none'}
        item={viewing}
        onClose={() => setViewing(null)}
      />
      <Dialog
        open={Boolean(renaming)}
        onOpenChange={(open) => !open && setRenaming(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename file</DialogTitle>
            <DialogDescription>
              Change how this file is named across the management area. Existing
              links keep working.
            </DialogDescription>
          </DialogHeader>
          <Field label="Filename">
            <Input
              value={renameValue}
              maxLength={120}
              onChange={(event) => setRenameValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && renameValue.trim())
                  void submitRename();
              }}
            />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenaming(null)}>
              Cancel
            </Button>
            <Button
              disabled={!renameValue.trim() || savingRename}
              onClick={() => void submitRename()}
            >
              <Save /> Save name
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

export function SchedulePanel({
  state,
  role = 'admin',
  onEditProgramme,
  onEditAnnouncement,
  onEditContent,
}: {
  state: DisplayState;
  role?: 'admin' | 'editor';
  onEditProgramme: (p: Programme) => void;
  onEditAnnouncement: (a: Announcement) => void;
  onEditContent: (item: ContentItem) => void;
}) {
  const items = useMemo(
    () => [
      ...(role === 'admin'
        ? state.programmes
            .filter((p) => p.displayFrom || p.displayUntil)
            .map((p) => ({
              id: `p${p.id}`,
              title: p.title,
              type: 'Programme',
              from: p.displayFrom,
              until: p.displayUntil,
              edit: () => onEditProgramme(p),
            }))
        : []),
      ...(role === 'admin'
        ? state.announcements
            .filter((a) => a.startDate || a.endDate)
            .map((a) => ({
              id: `a${a.id}`,
              title: a.title,
              type: 'Announcement',
              from: a.startDate,
              until: a.endDate,
              edit: () => onEditAnnouncement(a),
            }))
        : []),
      ...state.contentItems
        .filter(
          (item) => item.startAt || item.endAt || item.recurringWeekdays.length,
        )
        .map((item) => ({
          id: `c${item.id}`,
          title: item.title,
          type: item.type.replaceAll('_', ' '),
          from: item.startAt,
          until: item.endAt || (item.type === 'JANAZAH' ? 'Automatic' : ''),
          edit: () => onEditContent(item),
        })),
    ],
    [state, role, onEditProgramme, onEditAnnouncement, onEditContent],
  );
  return (
    <section>
      <h2 className="font-heading text-2xl font-bold">Scheduled content</h2>
      <p className="mb-5 text-muted-foreground">
        Items automatically appear and disappear at these times.
      </p>
      <div className="overflow-hidden rounded-xl border bg-white">
        {items.map((item) => (
          <div
            key={item.id}
            className="grid gap-3 border-b p-4 last:border-b-0 md:grid-cols-[1fr_160px_220px_220px_auto]"
          >
            <strong>{item.title}</strong>
            <span className="text-sm text-muted-foreground">{item.type}</span>
            <span className="text-sm">
              From:{' '}
              {item.from
                ? new Date(item.from).toLocaleString('en-ZA')
                : 'Immediately'}
            </span>
            <span className="text-sm">
              Until:{' '}
              {item.until === 'Automatic'
                ? 'Automatic after Janazah'
                : item.until
                  ? new Date(item.until).toLocaleString('en-ZA')
                  : 'No end date'}
            </span>
            <Button size="sm" variant="outline" onClick={item.edit}>
              <Pencil /> Edit
            </Button>
          </div>
        ))}
        {!items.length && (
          <div className="p-8 text-center text-muted-foreground">
            No scheduled content yet. Add display dates while editing a
            programme or announcement.
          </div>
        )}
      </div>
    </section>
  );
}

export function SettingsPanel({
  settings,
  islamicDate,
  media,
  onSave,
}: {
  settings: Settings;
  islamicDate: IslamicDateState;
  media: MediaItem[];
  onSave: (s: Settings) => Promise<void>;
}) {
  const [draft, setDraft] = useState(settings);
  useEffect(() => setDraft(settings), [settings]);
  return (
    <section className="max-w-5xl">
      <div className="grid gap-5 rounded-xl border bg-white p-6 md:grid-cols-2">
        <Field label="Masjid name">
          <Input
            value={draft.masjidName}
            onChange={(e) => setDraft({ ...draft, masjidName: e.target.value })}
          />
        </Field>
        <Field label="Masjid subtitle">
          <Input
            value={draft.masjidSubtitle}
            onChange={(e) =>
              setDraft({ ...draft, masjidSubtitle: e.target.value })
            }
          />
        </Field>
        <Field label="Logo">
          <Select
            value={draft.logoUrl || 'default'}
            onValueChange={(v) =>
              v && setDraft({ ...draft, logoUrl: v === 'default' ? '' : v })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Use default mark</SelectItem>
              {media
                .filter((m) => m.mimeType.startsWith('image/'))
                .map((m) => (
                  <SelectItem value={m.url} key={m.id}>
                    {m.filename}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Gold accent">
          <Input
            type="color"
            value={draft.goldAccent}
            onChange={(e) => setDraft({ ...draft, goldAccent: e.target.value })}
            className="h-10"
          />
        </Field>
        <Field label="Header quote" className="md:col-span-2">
          <Textarea
            value={draft.headerQuote}
            onChange={(e) =>
              setDraft({ ...draft, headerQuote: e.target.value })
            }
          />
        </Field>
        <Field label="Quote source">
          <Input
            value={draft.headerQuoteSource}
            onChange={(e) =>
              setDraft({ ...draft, headerQuoteSource: e.target.value })
            }
          />
        </Field>
        <Field label="Header right text">
          <Textarea
            rows={4}
            value={draft.headerRightText}
            onChange={(e) =>
              setDraft({ ...draft, headerRightText: e.target.value })
            }
          />
        </Field>
        <Field label="Footer left">
          <Input
            value={draft.footerLeftText}
            onChange={(e) =>
              setDraft({ ...draft, footerLeftText: e.target.value })
            }
          />
        </Field>
        <Field label="Footer right">
          <Input
            value={draft.footerRightText}
            onChange={(e) =>
              setDraft({ ...draft, footerRightText: e.target.value })
            }
          />
        </Field>
        <Field label="Footer centre" className="md:col-span-2">
          <Input
            value={draft.footerCentreText}
            onChange={(e) =>
              setDraft({ ...draft, footerCentreText: e.target.value })
            }
          />
        </Field>
        <Field label="Ticker text" className="md:col-span-2">
          <Textarea
            value={draft.tickerText}
            onChange={(e) => setDraft({ ...draft, tickerText: e.target.value })}
          />
        </Field>
        <ToggleField
          label="Scrolling ticker"
          checked={draft.tickerEnabled}
          onChange={(v) => setDraft({ ...draft, tickerEnabled: v })}
        />
        <Field label="Ticker speed (seconds)">
          <Input
            type="number"
            min="12"
            max="180"
            value={draft.tickerSpeed}
            onChange={(e) =>
              setDraft({ ...draft, tickerSpeed: Number(e.target.value) })
            }
          />
        </Field>
        <Field label="Ticker mode">
          <Select
            value={draft.tickerMode}
            onValueChange={(mode) =>
              mode &&
              setDraft({ ...draft, tickerMode: mode as Settings['tickerMode'] })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TEXT">Sliding text</SelectItem>
              <SelectItem value="HADITH">Hadith rotation</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Hadith rotation (seconds per hadith)">
          <Input
            type="number"
            min="5"
            max="120"
            value={draft.hadithDuration}
            onChange={(e) =>
              setDraft({ ...draft, hadithDuration: Number(e.target.value) })
            }
          />
        </Field>
        <Field label="Display refresh (seconds)">
          <Input
            type="number"
            min="3"
            max="300"
            value={draft.refreshInterval}
            onChange={(e) =>
              setDraft({ ...draft, refreshInterval: Number(e.target.value) })
            }
          />
        </Field>
        <Field label="Upcoming programmes">
          <Input
            type="number"
            min="1"
            max="4"
            value={draft.upcomingCount}
            onChange={(e) =>
              setDraft({ ...draft, upcomingCount: Number(e.target.value) })
            }
          />
        </Field>
        <Field label="Community poster page duration (seconds)">
          <Input
            type="number"
            min="15"
            max="20"
            value={draft.communityPosterInterval}
            onChange={(e) =>
              setDraft({
                ...draft,
                communityPosterInterval: Number(e.target.value),
              })
            }
          />
        </Field>
        <Field label="Timezone">
          <Input
            value={draft.timezone}
            onChange={(e) => setDraft({ ...draft, timezone: e.target.value })}
          />
        </Field>
        <Field label="Heading font">
          <Select
            value={draft.headingFont}
            onValueChange={(value) =>
              value &&
              setDraft({
                ...draft,
                headingFont: value as Settings['headingFont'],
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FONT_OPTIONS.map((option) => (
                <SelectItem key={option.key} value={option.key}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Body font">
          <Select
            value={draft.bodyFont}
            onValueChange={(value) =>
              value &&
              setDraft({ ...draft, bodyFont: value as Settings['bodyFont'] })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FONT_OPTIONS.map((option) => (
                <SelectItem key={option.key} value={option.key}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Urgent takeover duration (seconds)">
          <Input
            type="number"
            min="5"
            max="120"
            value={draft.takeoverDuration}
            onChange={(e) =>
              setDraft({ ...draft, takeoverDuration: Number(e.target.value) })
            }
          />
        </Field>
        <Field label="Islamic date source">
          <Select
            value={draft.islamicDateSource}
            onValueChange={(value) =>
              value &&
              setDraft({
                ...draft,
                islamicDateSource: value as Settings['islamicDateSource'],
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="JAMIAT">Automatic — Jamiat KZN</SelectItem>
              <SelectItem value="MANUAL">Manual override</SelectItem>
            </SelectContent>
          </Select>
          <p className="mt-2 text-xs text-muted-foreground">
            {islamicDate.source === 'JAMIAT' && islamicDate.value
              ? `Current Jamiat date: ${islamicDate.value}`
              : islamicDate.source === 'MANUAL'
                ? `Current manual date: ${islamicDate.value}`
                : 'Waiting for the first Jamiat update. The calculated date is used meanwhile.'}
          </p>
          {islamicDate.fetchedAt && (
            <p className="mt-1 text-xs text-muted-foreground">
              Last Jamiat update:{' '}
              {new Date(islamicDate.fetchedAt).toLocaleString('en-ZA')}
            </p>
          )}
        </Field>
        {draft.islamicDateSource === 'MANUAL' && (
          <Field label="Manual Islamic date">
            <Input
              value={draft.islamicDateManual}
              maxLength={80}
              placeholder="30 Rabiʽ al-awwal 1448 AH"
              onChange={(event) =>
                setDraft({
                  ...draft,
                  islamicDateManual: event.target.value,
                })
              }
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Switch the source back to Jamiat KZN to clear the override.
            </p>
          </Field>
        )}
        <div className="md:col-span-2">
          <h3 className="mb-3 font-semibold">Default carousel durations</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(
              Object.keys(draft.carouselDurations) as Array<
                keyof Settings['carouselDurations']
              >
            ).map((zone) => (
              <Field
                key={zone}
                label={`${zone === 'LIBRARY' ? 'COMMUNITY CARE' : zone.replaceAll('_', ' ')} (seconds)`}
              >
                <Input
                  type="number"
                  min="5"
                  max="300"
                  value={draft.carouselDurations[zone]}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      carouselDurations: {
                        ...draft.carouselDurations,
                        [zone]: Number(event.target.value),
                      },
                    })
                  }
                />
              </Field>
            ))}
          </div>
        </div>
        <div className="md:col-span-2">
          <Button onClick={() => onSave(draft)}>
            <Save /> Publish settings
          </Button>
        </div>
      </div>
    </section>
  );
}

export function ContentPanel({
  title,
  boardState,
  items,
  onAdd,
  onEdit,
  onDuplicate,
  onDelete,
  onToggle,
  onArchive,
  onMove,
}: {
  title: string;
  boardState: DisplayState;
  items: ContentItem[];
  onAdd: () => void;
  onEdit: (item: ContentItem) => void;
  onDuplicate: (item: ContentItem) => void;
  onDelete: (item: ContentItem) => void;
  onToggle: (item: ContentItem) => Promise<void>;
  onArchive: (item: ContentItem) => Promise<void>;
  onMove?: (item: ContentItem, direction: -1 | 1) => Promise<void>;
}) {
  const [previewItem, setPreviewItem] = useState<ContentItem | null>(null);
  const ordered = [...items].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.id - b.id,
  );
  return (
    <section>
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-2xl font-bold">{title}</h2>
          <p className="text-sm text-muted-foreground">
            Each active item rotates independently in its assigned board zone.
          </p>
        </div>
        <Button onClick={onAdd}>
          <Plus /> Add item
        </Button>
      </div>
      <div className="overflow-hidden rounded-xl border bg-white">
        {ordered.map((item) => (
          <article
            key={item.id}
            className="grid items-center gap-3 border-b p-4 last:border-b-0 lg:grid-cols-[minmax(180px,1fr)_130px_110px_120px_auto]"
          >
            <div className="flex min-w-0 items-center gap-3">
              {(item.type === 'EXTERNAL_POSTER' || item.imageUrl) && (
                <PosterThumbnail key={item.imageUrl} item={item} onClick={() => setPreviewItem(item)} />
              )}
              <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <strong className="truncate">{item.title}</strong>
                <StatusBadge item={item} />
              </div>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {item.type.replaceAll('_', ' ')} ·{' '}
                {item.zone.replaceAll('_', ' ')} · {item.priority}
              </p>
              </div>
            </div>
            <span className="text-sm">Order {item.sortOrder}</span>
            <span className="text-sm">{item.displayDuration}s</span>
            <span className="text-sm">
              {item.recurringWeekdays.length
                ? `${item.recurringWeekdays.length} recurring day(s)`
                : 'Every day'}
            </span>
            <div className="flex flex-wrap justify-end gap-1">
              <Button size="sm" variant="outline" onClick={() => setPreviewItem(item)}
                aria-label={`Preview ${item.title} on TV`}><Eye /> Preview</Button>
              <AdminActionButton hint="Move earlier"
                size="icon-sm"
                variant="ghost"
                disabled={!onMove}
                onClick={() => onMove && void onMove(item, -1)}
                aria-label={`Move ${item.title} earlier`}
              >
                <ChevronUp />
              </AdminActionButton>
              <AdminActionButton hint="Move later"
                size="icon-sm"
                variant="ghost"
                disabled={!onMove}
                onClick={() => onMove && void onMove(item, 1)}
                aria-label={`Move ${item.title} later`}
              >
                <ChevronDown />
              </AdminActionButton>
              <AdminActionButton hint="Edit notice"
                size="icon-sm"
                variant="ghost"
                onClick={() => onEdit(item)}
                aria-label={`Edit ${item.title}`}
              >
                <Pencil />
              </AdminActionButton>
              <AdminActionButton hint="Make a copy"
                size="icon-sm"
                variant="ghost"
                onClick={() => onDuplicate(item)}
                aria-label={`Duplicate ${item.title}`}
              >
                <Copy />
              </AdminActionButton>
              <AdminActionButton hint={item.enabled ? 'Pause on TV' : 'Enable on TV'}
                size="icon-sm"
                variant="ghost"
                onClick={() => void onToggle(item)}
                aria-label={
                  item.enabled ? `Pause ${item.title}` : `Enable ${item.title}`
                }
              >
                <MonitorPlay />
              </AdminActionButton>
              <AdminActionButton hint={item.archived ? 'Restore from archive' : 'Archive notice'}
                size="icon-sm"
                variant="ghost"
                onClick={() => void onArchive(item)}
                aria-label={`${item.archived ? 'Restore' : 'Archive'} ${item.title}`}
              >
                <Archive />
              </AdminActionButton>
              <AdminActionButton hint="Delete notice"
                size="icon-sm"
                variant="ghost"
                className="text-red-700"
                onClick={() => onDelete(item)}
                aria-label={`Delete ${item.title}`}
              >
                <Trash2 />
              </AdminActionButton>
            </div>
          </article>
        ))}
        {!ordered.length && (
          <div className="p-10 text-center text-muted-foreground">
            No items yet. Add the first one for this zone.
          </div>
        )}
      </div>
      <NoticePreviewDialog state={boardState} item={previewItem} onClose={() => setPreviewItem(null)} />
    </section>
  );
}

export function UsersPanel({
  users,
  onAdd,
  onEdit,
  onDelete,
}: {
  users: UserSummary[];
  onAdd: () => void;
  onEdit: (user: UserSummary) => void;
  onDelete: (user: UserSummary) => void;
}) {
  return (
    <section>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="font-heading text-2xl font-bold">Users</h2>
          <p className="text-muted-foreground">
            Administrators manage users; editors manage board content.
          </p>
        </div>
        <Button onClick={onAdd}>
          <Plus /> Add user
        </Button>
      </div>
      <div className="overflow-hidden rounded-xl border bg-white">
        {users.map((user) => (
          <div
            key={user.id}
            className="grid items-center gap-3 border-b p-4 last:border-0 md:grid-cols-[1fr_140px_120px_auto]"
          >
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <strong>{user.username}</strong>
              {user.root && (
                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                  PRIMARY ADMIN · PROTECTED
                </span>
              )}
            </div>
            <span className="capitalize">{user.role}</span>
            <span>{user.active ? 'Active' : 'Disabled'}</span>
            <div className="flex justify-end gap-1">
              <AdminActionButton hint="Edit user"
                size="icon-sm"
                variant="ghost"
                onClick={() => onEdit(user)}
              >
                <Pencil />
              </AdminActionButton>
              {user.root ? (
                <span
                  className="text-muted-foreground"
                  title="The primary administrator account cannot be deleted."
                  aria-label="Protected account"
                >
                  <ShieldCheck className="mx-2 size-4" />
                </span>
              ) : (
                <AdminActionButton hint="Delete user"
                  size="icon-sm"
                  variant="ghost"
                  className="text-red-700"
                  onClick={() => onDelete(user)}
                >
                  <Trash2 />
                </AdminActionButton>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function HadithPanel({
  items,
  onAdd,
  onEdit,
  onDelete,
  onMove,
  onToggle,
}: {
  items: HadithEntry[];
  onAdd: () => void;
  onEdit: (h: HadithEntry) => void;
  onDelete: (h: HadithEntry) => void;
  onMove: (h: HadithEntry, d: -1 | 1) => void;
  onToggle: (h: HadithEntry) => Promise<void>;
}) {
  const ordered = [...items].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.id - b.id,
  );
  return (
    <section>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="font-heading text-2xl font-bold">Hadith Library</h2>
          <p className="text-muted-foreground">
            The bottom bar rotates through these. Reference entries come from
            Sahih al-Bukhari and Sahih Muslim.
          </p>
        </div>
        <Button onClick={onAdd}>
          <Plus /> Add hadith
        </Button>
      </div>
      <div className="overflow-hidden rounded-xl border bg-white">
        {ordered.map((h, index) => (
          <div
            key={h.id}
            className="grid items-center gap-4 border-b p-4 last:border-b-0 md:grid-cols-[72px_1fr_110px_auto]"
          >
            <div className="flex">
              <AdminActionButton hint="Move earlier"
                size="icon-sm"
                variant="ghost"
                disabled={index === 0}
                onClick={() => onMove(h, -1)}
                aria-label="Move up"
              >
                <ChevronUp />
              </AdminActionButton>
              <AdminActionButton hint="Move later"
                size="icon-sm"
                variant="ghost"
                disabled={index === ordered.length - 1}
                onClick={() => onMove(h, 1)}
                aria-label="Move down"
              >
                <ChevronDown />
              </AdminActionButton>
            </div>
            <div className="flex min-w-0 items-center gap-4">
              <p
                dir="rtl"
                lang="ar"
                className="max-w-[38%] shrink-0 text-right font-[family-name:var(--font-amiri)] text-lg leading-snug text-[#8b6b1f]"
              >
                {h.arabic}
              </p>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{h.translation}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {h.narrator ? `${h.narrator} · ` : ''}
                  {h.reference}
                </p>
              </div>
            </div>
            <div>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${h.active ? 'bg-green-100 text-green-800' : 'bg-zinc-100 text-zinc-500'}`}
              >
                {h.active ? 'Active' : 'Paused'}
              </span>
            </div>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => void onToggle(h)}
              >
                {h.active ? 'Pause' : 'Show'}
              </Button>
              <AdminActionButton hint="Edit hadith"
                size="icon-sm"
                variant="ghost"
                onClick={() => onEdit(h)}
                aria-label={`Edit hadith ${h.reference}`}
              >
                <Pencil />
              </AdminActionButton>
              <AdminActionButton hint="Delete hadith"
                size="icon-sm"
                variant="ghost"
                className="text-red-700"
                onClick={() => onDelete(h)}
                aria-label={`Delete hadith ${h.reference}`}
              >
                <Trash2 />
              </AdminActionButton>
            </div>
          </div>
        ))}
        {!ordered.length && (
          <div className="p-10 text-center text-muted-foreground">
            The library is empty. Add the first hadith.
          </div>
        )}
      </div>
    </section>
  );
}

export function AuditPanel({
  entries,
  timezone,
}: {
  entries: NonNullable<DisplayState['auditLog']>;
  timezone: string;
}) {
  return (
    <section>
      <h2 className="font-heading text-2xl font-bold">Audit log</h2>
      <p className="mb-5 text-muted-foreground">
        The latest 100 management changes.
      </p>
      <div className="overflow-hidden rounded-xl border bg-white">
        {entries.map((entry) => (
          <div
            key={entry.id}
            className="grid gap-2 border-b p-4 last:border-0 md:grid-cols-[190px_130px_120px_1fr]"
          >
            <span className="text-sm">
              {new Date(entry.createdAt).toLocaleString('en-ZA', {
                timeZone: timezone,
              })}
            </span>
            <strong>{entry.username}</strong>
            <span className="uppercase text-sm">{entry.action}</span>
            <span>{entry.summary}</span>
          </div>
        ))}
        {!entries.length && (
          <div className="p-8 text-center text-muted-foreground">
            No changes recorded yet.
          </div>
        )}
      </div>
    </section>
  );
}
