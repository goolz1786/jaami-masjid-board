import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultDisplayState, type ContentItem } from '../lib/masjid-types';
import { validateContentItem } from '../lib/content-validation';

const fixture = vi.hoisted(() => ({
  role: 'admin',
  saveUser: vi.fn(),
  saveContentItem: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
}));
vi.mock('cloudflare:workers', () => ({ env: {} }));
vi.mock('next/server', () => ({
  NextResponse: {
    json: (value: unknown, init?: ResponseInit) => Response.json(value, init),
  },
}));
vi.mock('../lib/server-auth', () => ({
  isAuthenticated: async () => true,
  currentUser: async () => ({
    id: 1,
    username: 'admin',
    role: fixture.role,
    active: 1,
  }),
  login: fixture.login,
  logout: fixture.logout,
}));
vi.mock('../lib/server-data', async (original) => ({
  ...(await original<typeof import('../lib/server-data')>()),
  readState: async () => ({
    ...defaultDisplayState,
    users: [{ username: 'private' }],
    auditLog: [{ summary: 'private' }],
  }),
  saveUser: fixture.saveUser,
  saveContentItem: fixture.saveContentItem,
  writeAudit: vi.fn(),
}));
import { GET, POST } from '../app/api/admin/data/route';
import { POST as login } from '../app/api/auth/login/route';
import { POST as logout } from '../app/api/auth/logout/route';

const request = (body: unknown, origin = 'http://board.local:3000') =>
  new Request('http://board.local:3000/api/admin/data', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.clearAllMocks();
  fixture.role = 'admin';
});

describe('admin request authorization and validation', () => {
  it('blocks cross-origin mutations before any side effect', async () => {
    for (const route of [POST, login, logout])
      expect((await route(request({}, 'http://board.local:8000'))).status).toBe(
        403,
      );
    expect(fixture.saveUser).not.toHaveBeenCalled();
    expect(fixture.login).not.toHaveBeenCalled();
    expect(fixture.logout).not.toHaveBeenCalled();
  });
  it('keeps account and audit records out of editor responses', async () => {
    fixture.role = 'editor';
    const body = (await (await GET()).json()) as {
      users: unknown[];
      auditLog: unknown[];
    };
    expect(body.users).toEqual([]);
    expect(body.auditLog).toEqual([]);
    expect(
      (await POST(request({ entity: 'user', action: 'save', payload: {} })))
        .status,
    ).toBe(403);
  });
  it('enforces password, role and active-field validation on the server', async () => {
    for (const extra of [
      { password: 'short' },
      { role: 'owner' },
      { active: 'false' },
      { username: 'x'.repeat(129) },
    ]) {
      const response = await POST(
        request({
          entity: 'user',
          action: 'save',
          payload: {
            username: 'new-admin',
            password: 'a-long-test-password',
            role: 'admin',
            active: true,
            ...extra,
          },
        }),
      );
      expect(response.status).toBe(400);
    }
    expect(fixture.saveUser).not.toHaveBeenCalled();
  });
  it('rejects object-valued notice details without crashing validation', () => {
    const item = {
      title: 'Nikah',
      type: 'NIKAH',
      displayProfile: 'COMMUNITY',
      zone: 'NIKAH',
      displayDuration: 12,
      recurringWeekdays: [],
      details: { groomName: { unexpected: 'object' } },
    } as unknown as ContentItem;
    expect(validateContentItem(item).length).toBeGreaterThan(0);
    expect(
      validateContentItem(null as unknown as ContentItem).length,
    ).toBeGreaterThan(0);
  });
});
