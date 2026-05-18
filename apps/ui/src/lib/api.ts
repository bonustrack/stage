/** Daemon API: GET /api/state (one-shot + paging), GET /api/tail (SSE), POST /api/call/<train>/<action>. */

import type { HistoryEntry } from './types';

type JsonResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

async function getJson<T>(daemonUrl: string, token: string, path: string): Promise<JsonResult<T>> {
  try {
    const r = await fetch(`${daemonUrl.replace(/\/$/, '')}${path}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!r.ok) {
      const body = await r.text().catch(() => '');
      let msg = `HTTP ${r.status}`;
      try { msg = (JSON.parse(body) as { error?: string }).error ?? msg; } catch { /* keep msg */ }
      return { ok: false, status: r.status, error: msg };
    }
    return { ok: true, data: await r.json() as T };
  } catch (err) {
    return { ok: false, status: 0, error: err instanceof Error ? err.message : String(err) };
  }
}

export const fetchState = (daemonUrl: string, token: string): Promise<JsonResult<unknown>> =>
  getJson(daemonUrl, token, '/api/state');

export async function fetchHistoryPage(
  daemonUrl: string, token: string, before: number, limit: number,
): Promise<{ ok: true; entries: HistoryEntry[] } | { ok: false; status: number; error: string }> {
  const r = await getJson<{ recent_history?: HistoryEntry[] }>(
    daemonUrl, token, `/api/state?before=${before}&limit=${limit}`,
  );
  if (!r.ok) return r;
  return { ok: true, entries: r.data.recent_history ?? [] };
}

export async function sendCall(
  daemonUrl: string, token: string, train: string, action: string, args: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const r = await fetch(`${daemonUrl.replace(/\/$/, '')}/api/call/${train}/${action}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ args }),
    });
    if (r.ok) return { ok: true };
    const body = await r.text().catch(() => '');
    let msg = `HTTP ${r.status}`;
    try { msg = (JSON.parse(body) as { error?: string }).error ?? msg; } catch { /* keep msg */ }
    return { ok: false, error: msg };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export interface TailOptions {
  daemonUrl: string;
  token: string;
  as?: string;
  chat?: string;
  station?: string;
  includeWebhooks?: boolean;
  signal: AbortSignal;
  onOpen: () => void;
  onEntry: (e: HistoryEntry) => void;
  onError: (msg: string) => void;
  onClose: () => void;
}

function parseFrames(buf: string): { events: { event?: string; data?: string }[]; rest: string } {
  const events: { event?: string; data?: string }[] = [];
  let rest = buf;
  while (true) {
    const sep = rest.indexOf('\n\n');
    if (sep === -1) break;
    const block = rest.slice(0, sep);
    rest = rest.slice(sep + 2);
    const evt: { event?: string; data?: string } = {};
    for (const raw of block.split('\n')) {
      const line = raw.replace(/\r$/, '');
      if (!line || line.startsWith(':')) continue;
      const colon = line.indexOf(':');
      const field = colon === -1 ? line : line.slice(0, colon);
      const value = colon === -1 ? '' : line.slice(colon + 1).replace(/^ /, '');
      if (field === 'event') evt.event = value;
      else if (field === 'data') evt.data = (evt.data ? evt.data + '\n' : '') + value;
    }
    if (evt.data !== undefined) events.push(evt);
  }
  return { events, rest };
}

/** Open an SSE connection to /api/tail. Uses fetch streaming (browsers don't support */
/** custom headers on the native EventSource). Caller controls lifecycle via AbortController. */
export async function openTail(opts: TailOptions): Promise<void> {
  const params = new URLSearchParams();
  if (opts.as) params.set('as', opts.as);
  if (opts.chat) params.set('chat', opts.chat);
  if (opts.station) params.set('station', opts.station);
  if (opts.includeWebhooks) params.set('include_webhooks', 'true');
  const qs = params.toString();
  const url = `${opts.daemonUrl.replace(/\/$/, '')}/api/tail${qs ? `?${qs}` : ''}`;
  try {
    const r = await fetch(url, {
      headers: { authorization: `Bearer ${opts.token}` },
      signal: opts.signal,
    });
    if (!r.ok || !r.body) { opts.onError(`HTTP ${r.status}`); return; }
    opts.onOpen();
    const reader = r.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) { opts.onClose(); return; }
      buf += dec.decode(value, { stream: true });
      const { events, rest } = parseFrames(buf);
      buf = rest;
      for (const e of events) {
        if (e.event !== 'history' || !e.data) continue;
        try { opts.onEntry(JSON.parse(e.data) as HistoryEntry); } catch { /* skip */ }
      }
    }
  } catch (err) {
    if ((err as { name?: string }).name === 'AbortError') { opts.onClose(); return; }
    opts.onError(err instanceof Error ? err.message : String(err));
  }
}
