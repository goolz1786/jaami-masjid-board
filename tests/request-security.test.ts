import { describe, expect, it, vi } from 'vitest';
import {
  assertSameOrigin,
  readLimitedBody,
  readJsonBody,
} from '../lib/request-security';

describe('request boundaries', () => {
  it('rejects sibling origins even when the browser calls them same-site', () => {
    expect(() =>
      assertSameOrigin(
        new Request('http://board.local:3000/api/admin/data', {
          headers: {
            origin: 'http://board.local:8000',
            'sec-fetch-site': 'same-site',
          },
        }),
      ),
    ).toThrow(/origin/i);
    expect(() =>
      assertSameOrigin(
        new Request('http://board.local/api/auth/logout', {
          headers: { origin: 'null' },
        }),
      ),
    ).toThrow(/origin/i);
    expect(() =>
      assertSameOrigin(
        new Request('http://board.local/api/auth/logout', {
          headers: { 'sec-fetch-site': 'cross-site' },
        }),
      ),
    ).toThrow(/origin/i);
  });

  it('accepts same-origin browser calls and originless non-browser clients', () => {
    expect(() =>
      assertSameOrigin(
        new Request('http://board.local/api/admin/data', {
          headers: { origin: 'http://board.local' },
        }),
      ),
    ).not.toThrow();
    expect(() =>
      assertSameOrigin(new Request('http://localhost/api/admin/data')),
    ).not.toThrow();
  });

  it('limits streamed bytes even with a false or missing Content-Length', async () => {
    for (const headers of [{}, { 'content-length': '1' }]) {
      const cancel = vi.fn();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(6));
          controller.enqueue(new Uint8Array(6));
        },
        cancel,
      });
      const request = new Request('http://localhost', {
        method: 'POST',
        body: stream,
        headers,
        duplex: 'half',
      } as RequestInit);
      await expect(readLimitedBody(request, 10)).rejects.toMatchObject({
        status: 413,
      });
      expect(cancel).toHaveBeenCalledOnce();
    }
  });

  it('rejects simple-form JSON and malformed JSON, accepts valid JSON', async () => {
    const request = (type: string, body: string) =>
      new Request('http://localhost', {
        method: 'POST',
        headers: { 'content-type': type },
        body,
      });
    await expect(
      readJsonBody(request('text/plain', '{}')),
    ).rejects.toMatchObject({ status: 415 });
    await expect(
      readJsonBody(request('application/json', '{')),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      readJsonBody(request('application/json; charset=utf-8', '{"ok":true}')),
    ).resolves.toEqual({ ok: true });
  });
});
