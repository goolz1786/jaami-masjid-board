import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const project = resolve(import.meta.dirname, '..');
const read = (path: string) => readFileSync(resolve(project, path), 'utf8');

describe('system contracts', () => {
  it('has an additive smart-board migration', () => {
    const migration = read('drizzle/0001_smart_board_content.sql');
    expect(migration).toContain('CREATE TABLE `content_items`');
    expect(migration).toContain('CREATE TABLE `audit_log`');
    expect(migration).not.toMatch(/DROP TABLE|DELETE FROM/);
  });
  it('adds the community display profile without copying or deleting notices', () => {
    const migration = read('drizzle/0004_community_display.sql');
    expect(migration).toContain('display_profile');
    expect(migration).toContain("'JANAZAH', 'NIKAH', 'SICK_DUA'");
    expect(migration).not.toMatch(/DROP TABLE|DELETE FROM|INSERT INTO/);
  });
  it('keeps the canonical display endpoint and resilient live polling', () => {
    expect(read('app/display/main/page.tsx')).toContain("from '../page'");
    const display = read('app/display/page.tsx');
    expect(read('hooks/use-board-state.tsx')).toContain("fetch('/api/state'");
    expect(display).toContain('useIndependentCarousel');
  });
  it('refreshes the Jamiat date and exposes a manual admin override', () => {
    expect(read('app/api/state/route.ts')).toContain('refreshJamiatDateIfDue');
    expect(read('app/display/page.tsx')).toContain('state.islamicDate?.value');
    expect(read('app/display/community/page.tsx')).toContain(
      'state.islamicDate?.value',
    );
    const admin = read('app/admin/admin-panels.tsx');
    expect(admin).toContain('Automatic — Jamiat KZN');
    expect(admin).toContain('Manual override');
  });
  it('supports donation QR generation and persistent upload storage', () => {
    expect(read('app/display/page.tsx')).toContain('QRCode.toDataURL');
    expect(read('app/api/admin/upload/route.ts')).toContain('env.FILES.put');
  });
  it('provides a resilient portrait Community Board and real admin preview', () => {
    const community = read('app/display/community/page.tsx');
    expect(read('hooks/use-board-state.tsx')).toContain("fetch('/api/state'");
    expect(community).toContain('JANAZAH ANNOUNCEMENT');
    expect(community).toContain('COMMUNITY POSTERS');
    expect(community).not.toContain('QRCode.toDataURL');
    expect(community).not.toContain('WhatsAppPanel');
    const main = read('app/display/page.tsx');
    expect(main).toContain('JOIN OUR WHATSAPP GROUP');
    expect(main).toContain('FOR MALES ONLY');
    const communityCss = read('app/display/community/community.css');
    expect(communityCss).toContain('@media (max-aspect-ratio: 9/16)');
    expect(communityCss).toContain('height: 177.7778vw');
    expect(read('app/admin/admin-panels.tsx')).toContain(
      'src="/display/community"',
    );
  });
  it('accepts image and PDF poster uploads while preserving R2 storage', () => {
    const upload = read('app/api/admin/upload/route.ts');
    expect(upload).toContain("'application/pdf'");
    expect(upload).toContain('env.FILES.put');
    expect(read('app/display/community/page.tsx')).toContain('PdfPoster');
    const pdfPoster = read('components/pdf-poster.tsx');
    expect(pdfPoster).toContain('pdfjs-dist');
    expect(pdfPoster).toContain('canvas');
  });
  it('hides empty upcoming programmes and removes the library panel from Main', () => {
    const display = read('app/display/page.tsx');
    expect(display).toContain(
      "upcomingPages.length ? '' : 'main-row-expanded'",
    );
    expect(display).not.toContain('No upcoming programmes scheduled');
    expect(display).not.toContain('className="care-panel"');
    expect(display).toContain('return programme.dateText;');
    expect(display).not.toContain('[programme.dateText, programme.startTime]');
  });
  it('provides Windows 11 Docker deployment', () => {
    expect(read('Dockerfile')).toContain('node:22-bookworm-slim');
    expect(read('docker-compose.yml')).toContain('masjid-display');
  });
  it('provides one-click Windows installation and automatic startup', () => {
    expect(read('INSTALL-WINDOWS.cmd')).toContain('Install-Board.ps1');
    const installer = read('scripts/windows/Install-Board.ps1');
    expect(installer).toContain("Install-WingetPackage 'OpenJS.NodeJS.LTS'");
    expect(installer).toContain('New-ScheduledTaskTrigger -AtStartup');
    expect(installer).toContain('Register-ScheduledTask');
    expect(installer).toContain('New-NetFirewallRule');
    expect(installer).toContain("-RemoteAddress @('LocalSubnet', '100.64.0.0/10')");
    expect(installer).not.toContain('Start-Kiosk.ps1');
  });
  it('provides a Windows upgrade path and release packaging', () => {
    expect(read('UPGRADE-WINDOWS.cmd')).toContain('Upgrade-Board.ps1');
    const upgrade = read('scripts/windows/Upgrade-Board.ps1');
    expect(upgrade).toContain('Install-Board.ps1');
    expect(upgrade).toContain('Backup-Board.ps1');
    expect(upgrade).toContain("'.board-data'");
    expect(upgrade).toContain(".env");
    expect(read('PACKAGE-WINDOWS.cmd')).toContain('Package-Board.ps1');
    const pack = read('scripts/windows/Package-Board.ps1');
    expect(pack).toContain('Compress-Archive');
    expect(pack).toContain("'.board-data'");
  });
  it('starts a dedicated display client on the second monitor', () => {
    expect(read('display-client/INSTALL-DISPLAY-CLIENT.cmd')).toContain(
      'Install-DisplayClient.ps1',
    );
    const launcher = read('display-client/Launch-Display.ps1');
    expect(launcher).toContain('[System.Windows.Forms.Screen]::AllScreens');
    expect(launcher).toContain('Where-Object { -not $_.Primary }');
    expect(launcher).toContain('--window-position=');
    expect(launcher).toContain('--user-data-dir=');
    expect(read('display-client/Install-DisplayClient.ps1')).toContain(
      'New-ScheduledTaskTrigger -AtLogOn',
    );
  });
  it('initializes an empty hosted database before serving data or login', () => {
    const schema = read('lib/schema-upgrade.ts');
    expect(schema).toContain('CREATE TABLE IF NOT EXISTS users');
    expect(schema).toContain('CREATE TABLE IF NOT EXISTS content_items');
    expect(read('lib/server-auth.ts')).toContain('await ensureSchema()');
    expect(read('lib/server-data.ts')).toContain('await ensureSchema()');
  });
  it('uses the hosted PBKDF2 limit while retaining legacy hash migration', () => {
    const password = read('lib/password.ts');
    expect(password).toContain('CURRENT_ITERATIONS = 100_000');
    expect(password).toContain('LEGACY_ITERATIONS = 210_000');
    expect(password).toContain('pbkdf2$sha256$');
    expect(password).toContain('constantTimeEqual');
    const auth = read('lib/server-auth.ts');
    expect(auth).toContain('verifyPassword');
    expect(auth).toContain('needsRehash');
    expect(auth).toContain('UPDATE users SET password_hash=?');
  });
  it('restricts editors to content, media and hadith management', () => {
    const validation = read('lib/content-validation.ts');
    expect(validation).toContain("new Set(['content', 'media', 'hadith'])");
    expect(validation).toContain("role === 'admin'");
  });
  it('serves only uploaded media keys', () => {
    expect(read('app/api/media/[...key]/route.ts')).toContain(
      "startsWith('media/')",
    );
  });
});
