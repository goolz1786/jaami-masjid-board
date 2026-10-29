import { beforeEach, describe, expect, it, vi } from 'vitest';

const fixture = vi.hoisted(() => ({
  files: { put: vi.fn(), get: vi.fn() },
  addMedia: vi.fn(),
}));
vi.mock('cloudflare:workers', () => ({ env: { FILES: fixture.files } }));
vi.mock('next/server', () => ({ NextResponse: { json: (value: unknown, init?: ResponseInit) => Response.json(value, init) } }));
vi.mock('../lib/server-auth', () => ({ isAuthenticated: async () => true }));
vi.mock('../lib/server-data', () => ({ addMedia: fixture.addMedia }));

import { POST } from '../app/api/admin/upload/route';
import { GET } from '../app/api/media/[...key]/route';

beforeEach(() => vi.clearAllMocks());

describe('uploaded media safety', () => {
  it('rejects an upload initiated by a different origin', async () => {
    const form = new FormData();
    form.set('file', new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], 'poster.png', { type: 'image/png' }));
    const response = await POST(new Request('http://board.local/api/admin/upload', { method: 'POST', headers: { origin: 'http://other.local' }, body: form }));
    expect(response.status).toBe(403);
    expect(fixture.files.put).not.toHaveBeenCalled();
  });
  it('rejects HTML disguised as an image without storing it', async () => {
    const form = new FormData();
    form.set('file', new File(['<script>alert(1)</script>'], 'poster.png', { type: 'image/png' }));
    const response = await POST(new Request('http://localhost/api/admin/upload', { method: 'POST', body: form }));
    expect(response.status).toBe(400);
    expect(fixture.files.put).not.toHaveBeenCalled();
  });

  it('accepts an image with a matching PNG signature', async () => {
    const form = new FormData();
    form.set('file', new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0])], 'poster.png', { type: 'image/png' }));
    const response = await POST(new Request('http://localhost/api/admin/upload', { method: 'POST', body: form }));
    expect(response.status).toBe(200);
    expect(fixture.files.put).toHaveBeenCalledOnce();
  });

  it('prevents browser content sniffing on served files', async () => {
    fixture.files.get.mockResolvedValue({ body: 'file', httpEtag: 'etag', writeHttpMetadata: (h: Headers) => h.set('content-type', 'image/png') });
    const response = await GET(new Request('http://localhost/api/media/media/test.png'), { params: Promise.resolve({ key: ['media', 'test.png'] }) });
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  });
});
