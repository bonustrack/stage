
import { fetchPublic, readCappedText, UA } from './ssrf.ts';
import type { X402Challenge } from '@stage-labs/client/x402';
import { challengeFrom402 } from './x402.ts';

const TIMEOUT_MS = 5000;
const MAX_REDIRECTS = 3;
const MAX_BYTES = 1_500_000;
const X402_MAX_BYTES = 64_000;

interface FetchResult { html: string; finalUrl: string }

async function readJsonCapped(res: Response): Promise<unknown> {
  try {
    const text = await readCappedText(res, X402_MAX_BYTES, 'reject');
    return text === null ? null : JSON.parse(text);
  } catch {
    return null;
  }
}

const PAGE_HEADERS = {
  'User-Agent': UA,
  Accept: 'application/json,text/html,application/xhtml+xml',
  'Accept-Language': 'en-US,en;q=0.9',
};

async function challengeFor(res: Response, current: string): Promise<X402Challenge | null> {
  const ct = res.headers.get('content-type') ?? '';
  const body = /json/i.test(ct) ? await readJsonCapped(res) : null;
  return challengeFrom402(current, res.headers, body);
}

export async function fetchPage(rawUrl: string): Promise<FetchResult | X402Challenge | null> {
  const { res, finalUrl } = await fetchPublic(rawUrl, {
    maxRedirects: MAX_REDIRECTS, timeoutMs: TIMEOUT_MS, headers: () => PAGE_HEADERS,
  });
  if (res.status === 402) return challengeFor(res, finalUrl);
  if (!res.ok) return null;
  const ct = res.headers.get('content-type') ?? '';
  if (!/text\/html|application\/xhtml/i.test(ct)) return null;
  return { html: (await readCappedText(res, MAX_BYTES)) ?? '', finalUrl };
}
