'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  BellRing,
  BookOpen,
  CalendarClock,
  CircleGauge,
  ExternalLink,
  FileImage,
  HandHeart,
  LayoutTemplate,
  LogOut,
  MessageCircle,
  Megaphone,
  MonitorPlay,
  Plus,
  Settings as SettingsIcon,
  Star,
  Users,
  HeartPulse,
  ScrollText,
  UserCog,
} from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import {
  defaultAnnouncements,
  defaultDonation,
  defaultProgrammes,
  defaultSettings,
  type Announcement,
  type ContentItem,
  type DisplayState,
  type Programme,
} from '@/lib/masjid-types';

import { duplicateContentItem } from '@/lib/content-validation';

type Section =
  | 'Dashboard'
  | 'Displays'
  | 'Main Feature'
  | 'Upcoming Programmes'
  | 'Important Notices'
  | 'Community'
  | 'Donations'
  | 'Janazah'
  | 'Nikah'
  | 'Sick / Dua'
  | 'Ladies Taleem'
  | 'Community Posters'
  | 'WhatsApp QR'
  | 'Media'
  | 'Scheduling'
  | 'Hadith Library'
  | 'Users'
  | 'Settings'
  | 'Emergency'
  | 'Audit Log';
const sections: Array<{ name: Section; icon: typeof CircleGauge }> = [
  { name: 'Dashboard', icon: CircleGauge },
  { name: 'Displays', icon: MonitorPlay },
  { name: 'Main Feature', icon: Star },
  { name: 'Upcoming Programmes', icon: LayoutTemplate },
  { name: 'Important Notices', icon: Megaphone },
  { name: 'Community', icon: Users },
  { name: 'Donations', icon: HandHeart },
  { name: 'Janazah', icon: BellRing },
  { name: 'Nikah', icon: HeartPulse },
  { name: 'Sick / Dua', icon: HeartPulse },
  { name: 'Ladies Taleem', icon: Users },
  { name: 'Community Posters', icon: FileImage },
  { name: 'WhatsApp QR', icon: MessageCircle },
  { name: 'Media', icon: FileImage },
  { name: 'Scheduling', icon: CalendarClock },
  { name: 'Hadith Library', icon: BookOpen },
  { name: 'Users', icon: UserCog },
  { name: 'Settings', icon: SettingsIcon },
  { name: 'Emergency', icon: BellRing },
  { name: 'Audit Log', icon: ScrollText },
];
import {
  blankProgramme,
  blankAnnouncement,
  blankContent,
  blankHadith,
  apiAction,
  StatCard,
} from './admin-shared';
import {
  PreviewPanel,
  FeaturedPanel,
  ProgrammesPanel,
  AnnouncementsPanel,
  EmergencyPanel,
  DonationPanel,
  MediaPanel,
  SchedulePanel,
  SettingsPanel,
  ContentPanel,
  HadithPanel,
  UsersPanel,
  AuditPanel,
} from './admin-panels';
import {
  ContentDialog,
  UserDialog,
  ProgrammeDialog,
  AnnouncementDialog,
  HadithDialog,
} from './admin-dialogs';

const adminOnlySections: ReadonlySet<Section> = new Set([
  'Main Feature',
  'Upcoming Programmes',
  'Important Notices',
  'Community',
  'Donations',
  'Users',
  'Settings',
  'Emergency',
  'Audit Log',
]);

export function AdminApp({ role = 'editor' }: { role?: 'admin' | 'editor' }) {
  const [section, setSection] = useState<Section>('Dashboard');
  const [state, setState] = useState<DisplayState>({
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
  });
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [programmeDraft, setProgrammeDraft] = useState<Programme | null>(null);
  const [announcementDraft, setAnnouncementDraft] =
    useState<Announcement | null>(null);
  const [contentDraft, setContentDraft] = useState<ContentItem | null>(null);
  const [hadithDraft, setHadithDraft] = useState<{
    id?: number;
    arabic: string;
    translation: string;
    reference: string;
    narrator: string;
    sortOrder: number;
    active: boolean;
  } | null>(null);
  const [userDraft, setUserDraft] = useState<{
    id?: number;
    username: string;
    password: string;
    role: 'admin' | 'editor';
    active: boolean;
    root?: boolean;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    entity:
      | 'programme'
      | 'announcement'
      | 'content'
      | 'media'
      | 'hadith'
      | 'user';
    id: number;
    label: string;
  } | null>(null);

  const load = useCallback(async () => {
    const response = await fetch('/api/admin/data', { cache: 'no-store' });
    if (response.status === 401) {
      window.location.href = '/admin/login';
      return;
    }
    if (!response.ok) throw new Error('Could not load management data.');
    setState((await response.json()) as DisplayState);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load().catch((e: Error) => {
      setError(e.message);
      setLoading(false);
    });
  }, [load]);

  const save = useCallback(
    async (
      entity: string,
      payload: unknown,
      message = 'Published successfully.',
    ) => {
      setError('');
      try {
        await apiAction(entity, 'save', payload);
        await load();
        setNotice(message);
        window.setTimeout(() => setNotice(''), 2800);
      } catch (cause) {
        const message =
          cause instanceof Error
            ? cause.message
            : 'The change could not be saved.';
        setError(message);
        throw cause;
      }
    },
    [load],
  );

  useEffect(() => {
    const modelContext = (
      document as Document & {
        modelContext?: {
          registerTool?: (
            tool: unknown,
            options?: { signal?: AbortSignal },
          ) => void | Promise<void>;
        };
      }
    ).modelContext;
    if (!modelContext?.registerTool) return;
    const lifecycle = new AbortController();
    const tool = {
      name: 'set_emergency_notice',
      title: 'Set emergency notice',
      description:
        'Enable, update, or disable the emergency message shown on the live Masjid display.',
      inputSchema: {
        type: 'object',
        properties: {
          enabled: { type: 'boolean' },
          message: { type: 'string' },
          theme: { type: 'string', enum: ['red', 'gold', 'black'] },
        },
        required: ['enabled', 'message', 'theme'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: async (input: {
        enabled: boolean;
        message: string;
        theme: 'red' | 'gold' | 'black';
      }) => {
        const next = {
          ...state.settings,
          emergencyEnabled: input.enabled,
          emergencyMessage: input.message.trim(),
          emergencyTheme: input.theme,
        };
        await save('settings', next, 'Emergency notice updated.');
        setState((current) => ({ ...current, settings: next }));
        return {
          enabled: next.emergencyEnabled,
          message: next.emergencyMessage,
          theme: next.emergencyTheme,
        };
      },
    };
    try {
      void Promise.resolve(
        modelContext.registerTool(tool, { signal: lifecycle.signal }),
      ).catch(() => undefined);
    } catch {
      /* WebMCP is optional outside supported browsers. */
    }
    return () => lifecycle.abort();
  }, [save, state.settings]);

  const featured =
    state.programmes.find((p) => p.featured) ?? state.programmes[0];
  const upcoming = state.programmes.filter(
    (p) => p.active && p.showUpcoming,
  ).length;
  const scheduled =
    state.programmes.filter((p) => p.displayFrom || p.displayUntil).length +
    state.announcements.filter((a) => a.startDate || a.endDate).length;

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await apiAction(
        deleteTarget.entity,
        'delete',
        undefined,
        deleteTarget.id,
      );
      setDeleteTarget(null);
      await load();
      setNotice('Deleted.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed.');
    }
  }

  async function moveProgramme(programme: Programme, direction: -1 | 1) {
    const ordered = [...state.programmes].sort(
      (a, b) => a.sortOrder - b.sortOrder,
    );
    const index = ordered.findIndex((item) => item.id === programme.id);
    const other = ordered[index + direction];
    if (!other) return;
    await Promise.all([
      apiAction('programme', 'save', {
        ...programme,
        sortOrder: other.sortOrder,
      }),
      apiAction('programme', 'save', {
        ...other,
        sortOrder: programme.sortOrder,
      }),
    ]);
    await load();
  }

  async function moveHadith(
    hadith: { id?: number; sortOrder: number },
    direction: -1 | 1,
  ) {
    const ordered = [...(state.hadith ?? [])].sort(
      (a, b) => a.sortOrder - b.sortOrder || a.id - b.id,
    );
    const index = ordered.findIndex((item) => item.id === hadith.id);
    const other = ordered[index + direction];
    if (index < 0 || !other) return;
    await Promise.all([
      apiAction('hadith', 'save', { ...hadith, sortOrder: other.sortOrder }),
      apiAction('hadith', 'save', {
        ...other,
        sortOrder: hadith.sortOrder,
      }),
    ]);
    await load();
  }

  async function moveContentItem(item: ContentItem, direction: -1 | 1) {
    const ordered = state.contentItems
      .filter(
        (entry) =>
          entry.type === item.type &&
          entry.displayProfile === item.displayProfile,
      )
      .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
    const index = ordered.findIndex((entry) => entry.id === item.id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ordered.length) return;
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    await Promise.all(
      ordered.map((entry, order) =>
        apiAction('content', 'save', { ...entry, sortOrder: order * 10 }),
      ),
    );
    await load();
    setNotice('Display order updated.');
  }

  async function uploadFile(file: File) {
    const data = new FormData();
    data.append('file', file);
    setError('');
    const response = await fetch('/api/admin/upload', {
      method: 'POST',
      body: data,
    });
    const body = (await response.json()) as { error?: string; url?: string };
    if (!response.ok) throw new Error(body.error ?? 'Upload failed.');
    await load();
    setNotice(
      file.type === 'application/pdf' ? 'PDF uploaded.' : 'Image uploaded.',
    );
    return body.url ?? '';
  }

  async function logoutAdmin() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/admin/login';
  }

  const title = section;

  return (
    <SidebarProvider>
      <Sidebar className="border-r-0 bg-[#0c1118] text-white">
        <SidebarHeader className="border-b border-white/10 p-4">
          <div className="rounded-lg bg-white p-2">
            <img
              src="/assets/jaami-masjid-logo.png"
              alt="Jaami' Masjid Beyers Park"
              className="h-10 w-full object-contain"
            />
          </div>
          <div className="mt-1 text-center text-[10px] tracking-[.18em] text-white/60">
            DISPLAY MANAGEMENT
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel className="text-white/40">
              Manage board
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {sections
                  .filter(
                    ({ name }) =>
                      role === 'admin' || !adminOnlySections.has(name),
                  )
                  .map(({ name, icon: Icon }) => (
                    <SidebarMenuItem key={name}>
                      <SidebarMenuButton
                        isActive={section === name}
                        onClick={() => setSection(name)}
                        className="text-white hover:bg-white/10 hover:text-white data-[active=true]:bg-[#b69747] data-[active=true]:text-[#0c1118]"
                      >
                        <Icon /> <span>{name}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="border-t border-white/10 p-3">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={logoutAdmin}
                className="text-white/75 hover:bg-red-950 hover:text-white"
              >
                <LogOut /> Logout
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="min-h-screen bg-[#f5f2eb]">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-white px-5">
          <div className="flex items-center gap-3">
            <SidebarTrigger />
            <div>
              <h1 className="font-heading text-lg font-bold">{title}</h1>
              <p className="text-xs text-muted-foreground">
                Changes publish to the TV display automatically.
              </p>
            </div>
          </div>
          <a
            className={buttonVariants({ variant: 'outline' })}
            href="/display/main"
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink className="size-4" /> Open main board
          </a>
        </header>
        <div className="mx-auto w-full max-w-[1500px] p-5 md:p-8">
          {notice && (
            <output className="mb-5 block rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
              {notice}
            </output>
          )}
          {error && (
            <div
              role="alert"
              className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            >
              {error}
            </div>
          )}
          {loading ? (
            <div className="grid min-h-[60vh] place-items-center text-muted-foreground">
              Loading management area…
            </div>
          ) : (
            <>
              {section === 'Dashboard' && (
                <section>
                  <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
                    <div>
                      <h2 className="font-heading text-3xl font-bold">
                        Assalaamu Alaikum
                      </h2>
                      <p className="mt-1 text-muted-foreground">
                        Here is what is currently showing on the board.
                      </p>
                    </div>
                    <Button
                      className="bg-[#b69747] text-[#0c1118] hover:bg-[#caa956]"
                      onClick={() => setSection('Displays')}
                    >
                      <MonitorPlay /> Live preview
                    </Button>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <StatCard
                      label="Featured programme"
                      value={featured?.title ?? 'None'}
                      icon={Star}
                    />
                    <StatCard
                      label="Upcoming programmes"
                      value={upcoming}
                      icon={CalendarClock}
                    />
                    <StatCard
                      label="Scheduled items"
                      value={scheduled}
                      icon={BellRing}
                    />
                    <StatCard
                      label="Display status"
                      value={<span className="text-green-700">Online</span>}
                      icon={MonitorPlay}
                    />
                  </div>
                  <div className="mt-6 grid gap-5 xl:grid-cols-[1.6fr_1fr]">
                    <div className="rounded-xl border bg-white p-5">
                      <h3 className="font-heading mb-4 text-lg font-bold">
                        Quick actions
                      </h3>
                      <div className="flex flex-wrap gap-3">
                        {role === 'admin' && (
                          <Button
                            onClick={() =>
                              setProgrammeDraft({ ...blankProgramme })
                            }
                          >
                            <Plus /> New programme
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          onClick={() =>
                            setContentDraft(
                              blankContent('JANAZAH', 'JANAZAH', 'URGENT'),
                            )
                          }
                        >
                          <BellRing /> Janazah announcement
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() =>
                            setContentDraft(
                              blankContent('NIKAH', 'NIKAH', 'IMPORTANT'),
                            )
                          }
                        >
                          <HeartPulse /> Nikah announcement
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() =>
                            setContentDraft(
                              blankContent('SICK_DUA', 'SICK_DUA', 'IMPORTANT'),
                            )
                          }
                        >
                          <HeartPulse /> Sick / Dua notice
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() =>
                            setContentDraft(
                              blankContent(
                                'EXTERNAL_POSTER',
                                'COMMUNITY_POSTERS',
                              ),
                            )
                          }
                        >
                          <FileImage /> Community poster
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() =>
                            setContentDraft(
                              blankContent('LADIES_TALEEM', 'LADIES_TALEEM'),
                            )
                          }
                        >
                          <Users /> Ladies Taleem
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() =>
                            setContentDraft(
                              blankContent('WHATSAPP_QR', 'WHATSAPP_QR'),
                            )
                          }
                        >
                          <MessageCircle /> WhatsApp QR
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() =>
                            setContentDraft(
                              blankContent(
                                'GENERAL_NOTICE',
                                'IMPORTANT',
                                'IMPORTANT',
                              ),
                            )
                          }
                        >
                          <Megaphone /> Important notice
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() =>
                            setContentDraft(blankContent('DONATION', 'DONATE'))
                          }
                        >
                          <HandHeart /> Donation campaign
                        </Button>
                      </div>
                    </div>
                    <div className="rounded-xl border bg-white p-5">
                      <h3 className="font-heading mb-2 text-lg font-bold">
                        Last content update
                      </h3>
                      <p>
                        {new Date(state.lastUpdated).toLocaleString('en-ZA', {
                          timeZone: state.settings.timezone,
                        })}
                      </p>
                    </div>
                  </div>
                </section>
              )}
              {section === 'Displays' && <PreviewPanel />}
              {section === 'Main Feature' && (
                <FeaturedPanel
                  state={state}
                  onPublish={async (id) => {
                    const selected = state.programmes.find((p) => p.id === id);
                    if (selected)
                      await save(
                        'programme',
                        { ...selected, featured: true },
                        'Featured programme published.',
                      );
                  }}
                />
              )}
              {section === 'Upcoming Programmes' && (
                <ProgrammesPanel
                  programmes={state.programmes}
                  onAdd={() => setProgrammeDraft({ ...blankProgramme })}
                  onEdit={(p) => setProgrammeDraft({ ...p })}
                  onDuplicate={(p) =>
                    setProgrammeDraft({
                      ...p,
                      id: 0,
                      title: `${p.title} (copy)`,
                      active: false,
                      featured: false,
                    })
                  }
                  onToggle={(p) =>
                    save(
                      'programme',
                      { ...p, active: !p.active },
                      p.active ? 'Programme paused.' : 'Programme enabled.',
                    )
                  }
                  onArchive={(p) =>
                    save(
                      'programme',
                      { ...p, archived: !p.archived },
                      p.archived
                        ? 'Programme restored.'
                        : 'Programme archived.',
                    )
                  }
                  onDelete={(p) =>
                    setDeleteTarget({
                      entity: 'programme',
                      id: p.id,
                      label: p.title,
                    })
                  }
                  onMove={moveProgramme}
                />
              )}
              {section === 'Important Notices' && (
                <div className="space-y-8">
                  <AnnouncementsPanel
                    announcements={state.announcements.filter(
                      (item) => item.panelPosition !== 2,
                    )}
                    onAdd={() => setAnnouncementDraft({ ...blankAnnouncement })}
                    onEdit={(item) => setAnnouncementDraft({ ...item })}
                    onDelete={(item) =>
                      setDeleteTarget({
                        entity: 'announcement',
                        id: item.id,
                        label: item.title,
                      })
                    }
                  />
                  <ContentPanel
                    boardState={state}
                    title="Important notices"
                    items={state.contentItems.filter(
                      (item) =>
                        item.displayProfile === 'MAIN' &&
                        item.zone === 'IMPORTANT',
                    )}
                    onAdd={() =>
                      setContentDraft(
                        blankContent(
                          'GENERAL_NOTICE',
                          'IMPORTANT',
                          'IMPORTANT',
                        ),
                      )
                    }
                    onEdit={setContentDraft}
                    onDuplicate={(item) =>
                      setContentDraft(duplicateContentItem(item))
                    }
                    onDelete={(item) =>
                      setDeleteTarget({
                        entity: 'content',
                        id: item.id,
                        label: item.title,
                      })
                    }
                    onToggle={(item) =>
                      save(
                        'content',
                        { ...item, enabled: !item.enabled },
                        item.enabled ? 'Item paused.' : 'Item enabled.',
                      )
                    }
                    onArchive={(item) =>
                      save(
                        'content',
                        { ...item, archived: !item.archived },
                        item.archived ? 'Item restored.' : 'Item archived.',
                      )
                    }
                  />
                </div>
              )}
              {section === 'Community' && (
                <div className="space-y-8">
                  <AnnouncementsPanel
                    announcements={state.announcements.filter(
                      (item) => item.panelPosition === 2,
                    )}
                    onAdd={() =>
                      setAnnouncementDraft({
                        ...blankAnnouncement,
                        panelPosition: 2,
                        type: 'Community Announcement',
                      })
                    }
                    onEdit={(item) => setAnnouncementDraft({ ...item })}
                    onDelete={(item) =>
                      setDeleteTarget({
                        entity: 'announcement',
                        id: item.id,
                        label: item.title,
                      })
                    }
                    title="Community announcements"
                    description="Items shown in the lower community panel. Delete old sample notices here."
                    addLabel="Add community notice"
                  />
                  <ContentPanel
                    boardState={state}
                    title="Community"
                    items={state.contentItems.filter(
                      (item) =>
                        item.displayProfile === 'MAIN' &&
                        item.zone === 'COMMUNITY',
                    )}
                    onAdd={() =>
                      setContentDraft(blankContent('GENERAL_NOTICE', 'COMMUNITY'))
                    }
                    onEdit={setContentDraft}
                    onDuplicate={(item) =>
                      setContentDraft(duplicateContentItem(item))
                    }
                    onDelete={(item) =>
                      setDeleteTarget({
                        entity: 'content',
                        id: item.id,
                        label: item.title,
                      })
                    }
                    onToggle={(item) =>
                      save('content', { ...item, enabled: !item.enabled })
                    }
                    onArchive={(item) =>
                      save('content', { ...item, archived: !item.archived })
                    }
                  />
                </div>
              )}
              {section === 'Donations' && (
                <div className="space-y-8">
                  <DonationPanel
                    donation={state.donation}
                    media={state.media}
                    onSave={(donation) =>
                      save(
                        'donation',
                        donation,
                        'Default donation panel published.',
                      )
                    }
                  />
                  <ContentPanel
                    boardState={state}
                    title="Donation campaigns"
                    items={state.contentItems.filter(
                      (item) =>
                        item.displayProfile === 'MAIN' &&
                        item.type === 'DONATION',
                    )}
                    onAdd={() =>
                      setContentDraft(blankContent('DONATION', 'DONATE'))
                    }
                    onEdit={setContentDraft}
                    onDuplicate={(item) =>
                      setContentDraft(duplicateContentItem(item))
                    }
                    onDelete={(item) =>
                      setDeleteTarget({
                        entity: 'content',
                        id: item.id,
                        label: item.title,
                      })
                    }
                    onToggle={(item) =>
                      save('content', { ...item, enabled: !item.enabled })
                    }
                    onArchive={(item) =>
                      save('content', { ...item, archived: !item.archived })
                    }
                  />
                </div>
              )}
              {section === 'Janazah' && (
                <ContentPanel
                    boardState={state}
                  title="Janazah announcements"
                  items={state.contentItems.filter(
                    (item) => item.type === 'JANAZAH',
                  )}
                  onAdd={() =>
                    setContentDraft(
                      blankContent('JANAZAH', 'JANAZAH', 'URGENT'),
                    )
                  }
                  onEdit={setContentDraft}
                  onDuplicate={(item) =>
                    setContentDraft(duplicateContentItem(item))
                  }
                  onDelete={(item) =>
                    setDeleteTarget({
                      entity: 'content',
                      id: item.id,
                      label: item.title,
                    })
                  }
                  onToggle={(item) =>
                    save('content', { ...item, enabled: !item.enabled })
                  }
                  onArchive={(item) =>
                    save('content', { ...item, archived: !item.archived })
                  }
                />
              )}
              {section === 'Nikah' && (
                <ContentPanel
                    boardState={state}
                  title="Nikah announcements"
                  items={state.contentItems.filter(
                    (item) => item.type === 'NIKAH',
                  )}
                  onAdd={() =>
                    setContentDraft(blankContent('NIKAH', 'NIKAH', 'IMPORTANT'))
                  }
                  onEdit={setContentDraft}
                  onDuplicate={(item) =>
                    setContentDraft(duplicateContentItem(item))
                  }
                  onDelete={(item) =>
                    setDeleteTarget({
                      entity: 'content',
                      id: item.id,
                      label: item.title,
                    })
                  }
                  onToggle={(item) =>
                    save('content', { ...item, enabled: !item.enabled })
                  }
                  onArchive={(item) =>
                    save('content', { ...item, archived: !item.archived })
                  }
                />
              )}
              {section === 'Sick / Dua' && (
                <ContentPanel
                    boardState={state}
                  title="Sick / Dua requests"
                  items={state.contentItems.filter(
                    (item) => item.type === 'SICK_DUA',
                  )}
                  onAdd={() =>
                    setContentDraft(
                      blankContent('SICK_DUA', 'SICK_DUA', 'IMPORTANT'),
                    )
                  }
                  onEdit={setContentDraft}
                  onDuplicate={(item) =>
                    setContentDraft(duplicateContentItem(item))
                  }
                  onDelete={(item) =>
                    setDeleteTarget({
                      entity: 'content',
                      id: item.id,
                      label: item.title,
                    })
                  }
                  onToggle={(item) =>
                    save('content', { ...item, enabled: !item.enabled })
                  }
                  onArchive={(item) =>
                    save('content', { ...item, archived: !item.archived })
                  }
                />
              )}
              {section === 'Ladies Taleem' && (
                <ContentPanel
                    boardState={state}
                  title="Ladies Taleem"
                  items={state.contentItems.filter(
                    (item) => item.type === 'LADIES_TALEEM',
                  )}
                  onAdd={() =>
                    setContentDraft(
                      blankContent('LADIES_TALEEM', 'LADIES_TALEEM'),
                    )
                  }
                  onEdit={setContentDraft}
                  onDuplicate={(item) =>
                    setContentDraft(duplicateContentItem(item))
                  }
                  onDelete={(item) =>
                    setDeleteTarget({
                      entity: 'content',
                      id: item.id,
                      label: item.title,
                    })
                  }
                  onToggle={(item) =>
                    save('content', { ...item, enabled: !item.enabled })
                  }
                  onArchive={(item) =>
                    save('content', { ...item, archived: !item.archived })
                  }
                />
              )}
              {section === 'Community Posters' && (
                <ContentPanel
                    boardState={state}
                  title="Community Posters"
                  items={state.contentItems.filter(
                    (item) => item.type === 'EXTERNAL_POSTER',
                  )}
                  onAdd={() =>
                    setContentDraft(
                      blankContent('EXTERNAL_POSTER', 'COMMUNITY_POSTERS'),
                    )
                  }
                  onEdit={setContentDraft}
                  onDuplicate={(item) =>
                    setContentDraft(duplicateContentItem(item))
                  }
                  onDelete={(item) =>
                    setDeleteTarget({
                      entity: 'content',
                      id: item.id,
                      label: item.title,
                    })
                  }
                  onToggle={(item) =>
                    save('content', { ...item, enabled: !item.enabled })
                  }
                  onArchive={(item) =>
                    save('content', { ...item, archived: !item.archived })
                  }
                  onMove={moveContentItem}
                />
              )}
              {section === 'WhatsApp QR' && (
                <ContentPanel
                    boardState={state}
                  title="WhatsApp Group QR"
                  items={state.contentItems.filter(
                    (item) => item.type === 'WHATSAPP_QR',
                  )}
                  onAdd={() =>
                    setContentDraft(blankContent('WHATSAPP_QR', 'WHATSAPP_QR'))
                  }
                  onEdit={setContentDraft}
                  onDuplicate={(item) =>
                    setContentDraft(duplicateContentItem(item))
                  }
                  onDelete={(item) =>
                    setDeleteTarget({
                      entity: 'content',
                      id: item.id,
                      label: item.title,
                    })
                  }
                  onToggle={(item) =>
                    save('content', { ...item, enabled: !item.enabled })
                  }
                  onArchive={(item) =>
                    save('content', { ...item, archived: !item.archived })
                  }
                />
              )}
              {section === 'Media' && (
                <MediaPanel
                  media={state.media}
                  onUpload={uploadFile}
                  onRename={async (m, filename) => {
                    setError('');
                    try {
                      await apiAction('media', 'rename', {
                        id: m.id,
                        filename,
                      });
                      await load();
                      setNotice('Media renamed.');
                    } catch (cause) {
                      setError(
                        cause instanceof Error
                          ? cause.message
                          : 'Rename failed.',
                      );
                      throw cause;
                    }
                  }}
                  onDelete={(m) =>
                    setDeleteTarget({
                      entity: 'media',
                      id: m.id,
                      label: m.filename,
                    })
                  }
                />
              )}
              {section === 'Scheduling' && (
                <SchedulePanel
                  state={state}
                  role={role}
                  onEditProgramme={(p) => setProgrammeDraft({ ...p })}
                  onEditAnnouncement={(a) => setAnnouncementDraft({ ...a })}
                  onEditContent={(item) => setContentDraft({ ...item })}
                />
              )}
              {section === 'Hadith Library' && (
                <HadithPanel
                  items={state.hadith ?? []}
                  onAdd={() => setHadithDraft({ ...blankHadith })}
                  onEdit={(h) => setHadithDraft({ ...h })}
                  onDelete={(h) =>
                    setDeleteTarget({
                      entity: 'hadith',
                      id: h.id,
                      label: h.reference,
                    })
                  }
                  onMove={(h, d) => void moveHadith(h, d)}
                  onToggle={(h) =>
                    save(
                      'hadith',
                      { ...h, active: !h.active },
                      h.active ? 'Hadith paused.' : 'Hadith showing.',
                    )
                  }
                />
              )}
              {section === 'Users' && (
                <UsersPanel
                  users={state.users ?? []}
                  onAdd={() =>
                    setUserDraft({
                      username: '',
                      password: '',
                      role: 'editor',
                      active: true,
                    })
                  }
                  onEdit={(user) =>
                    setUserDraft({
                      id: user.id,
                      username: user.username,
                      password: '',
                      role: user.role,
                      active: user.active,
                      root: user.root,
                    })
                  }
                  onDelete={(user) =>
                    setDeleteTarget({
                      entity: 'user',
                      id: user.id,
                      label: user.username,
                    })
                  }
                />
              )}
              {section === 'Settings' && (
                <SettingsPanel
                  settings={state.settings}
                  islamicDate={state.islamicDate}
                  media={state.media}
                  onSave={(settings) =>
                    save('settings', settings, 'Display settings published.')
                  }
                />
              )}
              {section === 'Emergency' && (
                <EmergencyPanel
                  settings={state.settings}
                  onSave={(settings) =>
                    save('settings', settings, 'Emergency notice updated.')
                  }
                />
              )}
              {section === 'Audit Log' && (
                <AuditPanel
                  entries={state.auditLog ?? []}
                  timezone={state.settings.timezone}
                />
              )}
            </>
          )}
        </div>
      </SidebarInset>

      <ProgrammeDialog
        draft={programmeDraft}
        media={state.media}
        onClose={() => setProgrammeDraft(null)}
        onUpload={uploadFile}
        onSave={async (programme) => {
          await save(
            'programme',
            programme,
            programme.id ? 'Programme updated.' : 'Programme created.',
          );
          setProgrammeDraft(null);
        }}
      />
      <AnnouncementDialog
        draft={announcementDraft}
        onClose={() => setAnnouncementDraft(null)}
        onSave={async (announcement) => {
          await save(
            'announcement',
            announcement,
            announcement.id ? 'Announcement updated.' : 'Announcement created.',
          );
          setAnnouncementDraft(null);
        }}
      />
      <ContentDialog
        boardState={state}
        draft={contentDraft}
        media={state.media}
        onClose={() => setContentDraft(null)}
        onUpload={uploadFile}
        onSave={async (item) => {
          await save('content', item, 'Content saved.');
          setContentDraft(null);
        }}
      />
      <HadithDialog
        draft={hadithDraft}
        onClose={() => setHadithDraft(null)}
        onSave={async (hadith) => {
          await save(
            'hadith',
            hadith,
            hadith.id ? 'Hadith updated.' : 'Hadith added.',
          );
          setHadithDraft(null);
        }}
      />
      <UserDialog
        draft={userDraft}
        onClose={() => setUserDraft(null)}
        onSave={async (user) => {
          await save('user', user, 'User saved.');
          setUserDraft(null);
        }}
      />
      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.label}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the item from management and the display. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-700 hover:bg-red-800"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarProvider>
  );
}
