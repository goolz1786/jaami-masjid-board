import { beforeEach, describe, expect, it, vi } from 'vitest';

const fixture = vi.hoisted(() => ({
  files: { put: vi.fn(), get: vi.fn() },
  addMedia: vi.fn(),
  authenticated: true,
  readState: vi.fn(),
}));
vi.mock('cloudflare:workers', () => ({ env: { FILES: fixture.files } }));
vi.mock('next/server', () => ({
  NextResponse: {
    json: (value: unknown, init?: ResponseInit) => Response.json(value, init),
  },
}));
vi.mock('../lib/server-auth', () => ({
  isAuthenticated: async () => fixture.authenticated,
}));
vi.mock('../lib/server-data', () => ({
  addMedia: fixture.addMedia,
  readState: fixture.readState,
}));

import { POST } from '../app/api/admin/upload/route';
import { GET } from '../app/api/media/[...key]/route';
import { defaultDisplayState } from '../lib/masjid-types';

beforeEach(() => {
  vi.clearAllMocks();
  fixture.authenticated = true;
  fixture.readState.mockResolvedValue(defaultDisplayState);
});

describe('uploaded media safety', () => {
  it('denies unpublished media without fetching its bytes', async () => {
    fixture.authenticated = false;
    fixture.files.get.mockResolvedValue({
      body: 'private',
      httpEtag: 'etag',
      writeHttpMetadata: () => {},
    });
    const response = await GET(
      new Request('http://localhost/api/media/media/draft.pdf'),
      { params: Promise.resolve({ key: ['media', 'draft.pdf'] }) },
    );
    expect(response.status).toBe(404);
    expect(fixture.files.get).not.toHaveBeenCalled();
  });

  it('serves a published logo without a session and stops serving after unpublication', async () => {
    fixture.authenticated = false;
    fixture.files.get.mockResolvedValue({
      body: 'image',
      httpEtag: 'etag',
      writeHttpMetadata: (h: Headers) => h.set('content-type', 'image/png'),
    });
    fixture.readState.mockResolvedValueOnce({
      ...defaultDisplayState,
      settings: {
        ...defaultDisplayState.settings,
        logoUrl: '/api/media/media%2Flogo.png',
      },
    });
    const request = () =>
      GET(new Request('http://localhost/api/media/media/logo.png'), {
        params: Promise.resolve({ key: ['media', 'logo.png'] }),
      });
    const published = await request();
    expect(published.status).toBe(200);
    expect(published.headers.get('cache-control')).toContain('no-store');
    expect((await request()).status).toBe(404);
  });

  it('rejects a declared oversized body before multipart parsing', async () => {
    const request = new Request('http://localhost/api/admin/upload', {
      method: 'POST',
      headers: {
        'content-length': String(22 * 1024 * 1024),
        'content-type': 'multipart/form-data; boundary=x',
      },
      body: 'invalid multipart',
    });
    expect((await POST(request)).status).toBe(413);
    expect(fixture.files.put).not.toHaveBeenCalled();
  });

  it('recognizes same-origin absolute media references but rejects foreign references', async () => {
    fixture.authenticated = false;
    fixture.files.get.mockResolvedValue({
      body: 'image',
      httpEtag: 'etag',
      writeHttpMetadata: (h: Headers) => h.set('content-type', 'image/png'),
    });
    for (const origin of ['http://localhost', 'http://foreign.example']) {
      fixture.readState.mockResolvedValue({
        ...defaultDisplayState,
        settings: {
          ...defaultDisplayState.settings,
          logoUrl: `${origin}/api/media/media%2Flogo.png`,
        },
      });
      const result = await GET(
        new Request('http://localhost/api/media/media/logo.png'),
        { params: Promise.resolve({ key: ['media', 'logo.png'] }) },
      );
      expect(result.status).toBe(origin === 'http://localhost' ? 200 : 404);
    }
  });
  it('rejects an upload initiated by a different origin', async () => {
    const form = new FormData();
    form.set(
      'file',
      new File(
        [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])],
        'poster.png',
        { type: 'image/png' },
      ),
    );
    const response = await POST(
      new Request('http://board.local/api/admin/upload', {
        method: 'POST',
        headers: { origin: 'http://other.local' },
        body: form,
      }),
    );
    expect(response.status).toBe(403);
    expect(fixture.files.put).not.toHaveBeenCalled();
  });
  it('rejects HTML disguised as an image without storing it', async () => {
    const form = new FormData();
    form.set(
      'file',
      new File(['<script>alert(1)</script>'], 'poster.png', {
        type: 'image/png',
      }),
    );
    const response = await POST(
      new Request('http://localhost/api/admin/upload', {
        method: 'POST',
        body: form,
      }),
    );
    expect(response.status).toBe(400);
    expect(fixture.files.put).not.toHaveBeenCalled();
  });

  it('accepts an image with a matching PNG signature', async () => {
    const form = new FormData();
    form.set(
      'file',
      new File(
        [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0])],
        'poster.png',
        { type: 'image/png' },
      ),
    );
    const response = await POST(
      new Request('http://localhost/api/admin/upload', {
        method: 'POST',
        body: form,
      }),
    );
    expect(response.status).toBe(200);
    expect(fixture.files.put).toHaveBeenCalledOnce();
  });

  it('prevents browser content sniffing on served files', async () => {
    fixture.files.get.mockResolvedValue({
      body: 'file',
      httpEtag: 'etag',
      writeHttpMetadata: (h: Headers) => h.set('content-type', 'image/png'),
    });
    const response = await GET(
      new Request('http://localhost/api/media/media/test.png'),
      { params: Promise.resolve({ key: ['media', 'test.png'] }) },
    );
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  });
});
