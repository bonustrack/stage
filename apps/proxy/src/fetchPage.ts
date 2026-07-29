
import { assertPublicUrl, readCappedText, SsrfError } from './ssrf.ts';
import { challengeFrom402, type X402Challenge } from './x402.ts';

const TIMEOUT_MS = 5000;
const MAX_REDIRECTS = 3;
const MAX_BYTES = 1_500_000;
const X402_MAX_BYTES = 64_000;
const UA = 'Mozilla/5.0 (compatible; MetroLinkPreview/1.0; +https://metro.box)';

export interface FetchResult { html: string; finalUrl: string }

async function readJsonCapped(res: Response): Promise<unknown> {
  try {
    const text = await readCappedText(res, X402_MAX_BYTES, 'reject');
    return text === null ? null : JSON.parse(text);
  } catch {
    return null;
  }
}

interface Redirect { redirectTo: string }
function isRedirect(v: unknown): v is Redirect {
  return typeof v === 'object' && v !== null && 'redirectTo' in v;
}

async function fetchOnce(current: string): Promise<Response> {
  return fetch(current, {
    method: 'GET',
    redirect: 'manual',
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: {
      'User-Agent': UA,
      Accept: 'application/json,text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });
}

async function challengeFor(res: Response, current: string): Promise<X402Challenge | null> {
  const ct = res.headers.get('content-type') ?? '';
  const body = /json/i.test(ct) ? await readJsonCapped(res) : null;
  return challengeFrom402(current, res.headers, body);
}

async function handleResponse(
  res: Response,
  current: string,
): Promise<FetchResult | X402Challenge | Redirect | null> {
  if (res.status === 402) return challengeFor(res, current);
  if (res.status >= 300 && res.status < 400) {
    const loc = res.headers.get('location');
    if (!loc) return null;
    const next = assertPublicUrl(new URL(loc, current).toString()).toString();
    return { redirectTo: next };
  }
  if (!res.ok) return null;
  const ct = res.headers.get('content-type') ?? '';
  if (!/text\/html|application\/xhtml/i.test(ct)) return null;
  return { html: (await readCappedText(res, MAX_BYTES)) ?? '', finalUrl: current };
}

export async function fetchPage(rawUrl: string): Promise<FetchResult | X402Challenge | null> {
  let current = assertPublicUrl(rawUrl).toString();
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const outcome = await handleResponse(await fetchOnce(current), current);
    if (isRedirect(outcome)) { current = outcome.redirectTo; continue; }
    return outcome;
  }
  throw new SsrfError('too many redirects');
}
