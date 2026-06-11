/** Safe server-side page fetch for the link-preview proxy.
 *
 *  Wraps the global fetch with: a hard timeout, a manual redirect loop that
 *  re-runs the SSRF guard on every hop (so a public URL can't 302 to
 *  127.0.0.1), a max-redirect cap, a max-body-size cap (we only need the
 *  <head>, so we stop reading early), a desktop-ish User-Agent (some sites omit
 *  OG tags for bots), and cookie/credential stripping (we never send or store
 *  cookies). HTML-only: non-HTML responses return null. */

import { assertPublicUrl, SsrfError } from './ssrf.ts';
import { challengeFrom402, type X402Challenge } from './x402.ts';

const TIMEOUT_MS = 5000;
const MAX_REDIRECTS = 3;
const MAX_BYTES = 1_500_000; // 1.5 MB cap; the head is far smaller
const X402_MAX_BYTES = 64_000; // x402 challenge bodies are tiny JSON
const UA =
  'Mozilla/5.0 (compatible; MetroLinkPreview/1.0; +https://metro.box)';

export interface FetchResult { html: string; finalUrl: string }

/** Read a response body up to MAX_BYTES, decoding as UTF-8. Aborts the stream
 *  once enough bytes for the head are in hand. */
async function readCapped(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return await res.text();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      total += value.length;
      if (total >= MAX_BYTES) { void reader.cancel(); break; }
    }
  }
  return new TextDecoder('utf-8').decode(concat(chunks));
}

function concat(chunks: Uint8Array[]): Uint8Array {
  const len = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(len);
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.length; }
  return out;
}

/** A small JSON body read (capped), for x402 challenge bodies. Returns the
 *  parsed value or null on bad/oversized/non-JSON. */
async function readJsonCapped(res: Response): Promise<unknown> {
  try {
    const reader = res.body?.getReader();
    if (!reader) return JSON.parse(await res.text());
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        total += value.length;
        if (total > X402_MAX_BYTES) { void reader.cancel(); return null; }
      }
    }
    return JSON.parse(new TextDecoder('utf-8').decode(concat(chunks)));
  } catch {
    return null;
  }
}

/** Fetch `rawUrl` safely and return its HTML + final (post-redirect) URL, an
 *  {@link X402Challenge} when the resource answers HTTP 402 with an x402 payment
 *  challenge, or null when there's nothing previewable. Throws {@link SsrfError}
 *  if any URL in the redirect chain is unsafe. */
export async function fetchPage(rawUrl: string): Promise<FetchResult | X402Challenge | null> {
  let current = (await assertPublicUrl(rawUrl)).toString();

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(current, {
        method: 'GET',
        redirect: 'manual',
        signal: ctrl.signal,
        // Strip any ambient credentials; we never authenticate.
        credentials: 'omit',
        headers: {
          'User-Agent': UA,
          // Advertise that we understand x402 JSON challenges as well as HTML.
          Accept: 'application/json,text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });
    } finally {
      clearTimeout(timer);
    }

    // x402: a 402 carries a payment challenge (JSON body and/or PAYMENT-REQUIRED
    // header). Parse it instead of treating 402 as a dead end.
    if (res.status === 402) {
      const ct = res.headers.get('content-type') ?? '';
      const body = /json/i.test(ct) ? await readJsonCapped(res) : null;
      return challengeFrom402(current, res.headers, body);
    }

    // Manual redirect handling: validate the next hop through the SSRF guard.
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (!loc) return null;
      const next = new URL(loc, current).toString();
      current = (await assertPublicUrl(next)).toString();
      continue;
    }

    if (!res.ok) return null;
    const ct = res.headers.get('content-type') ?? '';
    if (!/text\/html|application\/xhtml/i.test(ct)) return null;

    const html = await readCapped(res);
    return { html, finalUrl: current };
  }
  throw new SsrfError('too many redirects');
}
