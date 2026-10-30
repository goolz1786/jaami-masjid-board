export class RequestError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  const site = request.headers.get('sec-fetch-site');
  if (
    (origin !== null && origin !== new URL(request.url).origin) ||
    (!origin && (site === 'cross-site' || site === 'same-site'))
  ) {
    throw new RequestError(403, 'Invalid request origin.');
  }
}

// Count actual bytes: Content-Length alone is untrusted and can be absent.
export async function readLimitedBody(
  request: Request,
  maxBytes: number,
): Promise<Uint8Array<ArrayBuffer>> {
  const declared = request.headers.get('content-length');
  if (
    declared !== null &&
    (!/^\d+$/.test(declared) || Number(declared) > maxBytes)
  ) {
    void request.body?.cancel().catch(() => undefined);
    throw new RequestError(413, 'Request body is too large.');
  }
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new RequestError(408, 'Request body timed out.')),
      30_000,
    );
  });
  try {
    for (;;) {
      const { done, value } = await Promise.race([reader.read(), timeout]);
      if (done) break;
      length += value.byteLength;
      if (length > maxBytes)
        throw new RequestError(413, 'Request body is too large.');
      chunks.push(value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return bytes;
  } catch (error) {
    void reader.cancel().catch(() => undefined);
    throw error;
  } finally {
    clearTimeout(timer);
    reader.releaseLock();
  }
}

export async function readJsonBody(
  request: Request,
  maxBytes = 64 * 1024,
): Promise<unknown> {
  if (
    request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !==
    'application/json'
  )
    throw new RequestError(415, 'Use application/json.');
  const bytes = await readLimitedBody(request, maxBytes);
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw new RequestError(400, 'Invalid JSON body.');
  }
}

export function requestErrorResponse(
  error: unknown,
  fallback = 'The request could not be completed.',
) {
  return Response.json(
    { error: error instanceof RequestError ? error.message : fallback },
    {
      status: error instanceof RequestError ? error.status : 500,
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}
