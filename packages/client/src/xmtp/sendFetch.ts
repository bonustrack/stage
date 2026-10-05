type Fetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
interface Reply { response: Response; ok: boolean; controller: AbortController }

const METHODS = new Set([
  '/xmtp.identity.api.v1.IdentityApi/GetIdentityUpdates',
  '/xmtp.mls.api.v1.MlsApi/SendGroupMessages',
  '/xmtp.mls.api.v1.MlsApi/QueryGroupMessages',
]);
const HOSTS = new Set(['api.production.xmtp.network:5558', 'api.dev.xmtp.network:5558']);

function statusFromFrames(body: ArrayBuffer, header: string | null): string | null {
  const view = new DataView(body);
  if (body.byteLength < 5 || view.getUint8(0) !== 0) return null;
  const at = 5 + view.getUint32(1);
  if (at === body.byteLength) return header;
  if (at + 5 > body.byteLength || view.getUint8(at) !== 128) return null;
  const length = view.getUint32(at + 1);
  if (at + 5 + length !== body.byteLength) return null;
  const trailers = new TextDecoder().decode(new Uint8Array(body, at + 5, length));
  return /(?:^|\r\n)grpc-status:\s*(\d+)\r\n/.exec(trailers)?.[1] ?? null;
}

async function readReply(response: Response, controller: AbortController): Promise<Reply> {
  const header = response.headers.get('grpc-status');
  const encoding = response.headers.get('content-type')?.split(';')[0];
  const binary = encoding === 'application/grpc-web+proto' || encoding === 'application/grpc-web';
  if (!response.ok || (header !== null && header !== '0') || !binary) return { response, controller, ok: false };
  const body = await response.arrayBuffer();
  return {
    response: new Response(body.byteLength ? body : null, { status: response.status, statusText: response.statusText, headers: response.headers }),
    controller,
    ok: statusFromFrames(body, header) === '0',
  };
}

async function hedge(request: Request, fetch: Fetch, delayMs: number): Promise<Response> {
  const original = new AbortController();
  const backup = new AbortController();
  let winner: AbortController | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const run = (controller: AbortController) => fetch(request.clone(), {
    signal: AbortSignal.any([request.signal, controller.signal]),
  }).then((response) => readReply(response, controller));
  try {
    request.signal.throwIfAborted();
    const first = run(original);
    const elapsed = new Promise<null>((resolve) => { timer = setTimeout(() => { resolve(null); }, delayMs); });
    const early = await Promise.race([first, elapsed]);
    const result = early ?? await Promise.race([
      first,
      run(backup).then((reply) => reply.ok ? reply : first, () => first),
    ]);
    request.signal.throwIfAborted();
    winner = result.controller;
    return result.response;
  } finally {
    clearTimeout(timer);
    if (winner !== original) original.abort();
    if (winner !== backup) backup.abort();
  }
}

export function createXmtpSendFetch(fetch: Fetch, delayMs = 300) {
  let sends = 0;
  const inFlight = new Set<string>();
  return {
    async send<T>(run: () => Promise<T>): Promise<T> {
      sends++;
      try { return await run(); } finally { sends--; }
    },
    async fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
      if (!sends) return fetch(input, init);
      const url = new URL(input instanceof Request ? input.url : String(input));
      if (url.protocol !== 'https:' || !HOSTS.has(url.host) || !METHODS.has(url.pathname) || inFlight.has(url.pathname)) return fetch(input, init);
      const request = new Request(input, init);
      if (request.method !== 'POST' || request.headers.get('content-type') !== 'application/grpc-web+proto') return fetch(request);
      inFlight.add(url.pathname);
      try { return await hedge(request, fetch, delayMs); } finally { inFlight.delete(url.pathname); }
    },
  };
}
