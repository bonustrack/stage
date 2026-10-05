type Fetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
interface Reply { response: Response; ok: boolean }

const METHODS = new Set([
  '/xmtp.identity.api.v1.IdentityApi/GetIdentityUpdates',
  '/xmtp.mls.api.v1.MlsApi/SendGroupMessages',
  '/xmtp.mls.api.v1.MlsApi/QueryGroupMessages',
]);
const HOSTS = new Set(['api.production.xmtp.network:5558', 'api.dev.xmtp.network:5558']);

function statusFromFrames(body: ArrayBuffer): string | null {
  const view = new DataView(body);
  for (let at = 0; at + 5 <= body.byteLength;) {
    const flags = view.getUint8(at);
    const length = view.getUint32(at + 1);
    const end = at + 5 + length;
    if (end > body.byteLength) return null;
    if (flags === 128 && end === body.byteLength) {
      const trailers = new TextDecoder().decode(new Uint8Array(body, at + 5, length));
      return /(?:^|\r\n)grpc-status:\s*(\d+)\r\n/.exec(trailers)?.[1] ?? null;
    }
    at = end;
  }
  return null;
}

async function readReply(response: Response): Promise<Reply> {
  const body = await response.arrayBuffer();
  const status = statusFromFrames(body) ?? response.headers.get('grpc-status');
  return {
    response: new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers }),
    ok: response.ok && status === '0',
  };
}

async function firstSuccess(first: Promise<Reply>, second: Promise<Reply>): Promise<Response> {
  const success = async (reply: Promise<Reply>) => {
    const result = await reply;
    if (!result.ok) throw new Error('XMTP request was not acknowledged');
    return result.response;
  };
  try {
    return await Promise.any([success(first), success(second)]);
  } catch {
    return (await first).response;
  }
}

async function hedge(request: Request, fetch: Fetch, delayMs: number): Promise<Response> {
  const controllers = [new AbortController(), new AbortController()];
  const abort = () => { controllers.forEach((controller) => { controller.abort(request.signal.reason); }); };
  request.signal.throwIfAborted();
  request.signal.addEventListener('abort', abort, { once: true });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const run = (index: number) => fetch(request.clone(), { signal: controllers[index]?.signal }).then(readReply);
  try {
    const first = run(0);
    const elapsed = new Promise<null>((resolve) => { timer = setTimeout(() => { resolve(null); }, delayMs); });
    const early = await Promise.race([first, elapsed]);
    if (early) return early.response;
    return await firstSuccess(first, run(1));
  } finally {
    clearTimeout(timer);
    request.signal.removeEventListener('abort', abort);
    controllers.forEach((controller) => { controller.abort(); });
  }
}

export function createXmtpSendFetch(fetch: Fetch, delayMs = 300) {
  let sends = 0;
  let hedging = false;
  return {
    async send<T>(run: () => Promise<T>): Promise<T> {
      sends++;
      try { return await run(); } finally { sends--; }
    },
    async fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
      if (!sends || hedging) return fetch(input, init);
      const url = new URL(input instanceof Request ? input.url : String(input));
      if (url.protocol !== 'https:' || !HOSTS.has(url.host) || !METHODS.has(url.pathname)) return fetch(input, init);
      const request = new Request(input, init);
      if (request.method !== 'POST' || request.headers.get('content-type') !== 'application/grpc-web+proto') return fetch(input, init);
      hedging = true;
      try { return await hedge(request, fetch, delayMs); } finally { hedging = false; }
    },
  };
}
