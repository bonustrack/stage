/** SSE reader for RN. Uses XHR (fetch streaming on Android via Cloudflare is broken). */

import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import type { HistoryEntry } from './types';

type SseEvent = { id?: string; event?: string; data?: string };

/** Parse SSE frames out of a rolling string buffer. Returns parsed events + remaining tail. */
function parseFrames(buf: string): { events: SseEvent[]; rest: string } {
  const events: SseEvent[] = [];
  let rest = buf;
  while (true) {
    const sep = rest.indexOf('\n\n');
    if (sep === -1) break;
    const block = rest.slice(0, sep);
    rest = rest.slice(sep + 2);
    const evt: SseEvent = {};
    for (const lineRaw of block.split('\n')) {
      const line = lineRaw.replace(/\r$/, '');
      if (!line || line.startsWith(':')) continue;
      const colon = line.indexOf(':');
      const field = colon === -1 ? line : line.slice(0, colon);
      const value = colon === -1 ? '' : line.slice(colon + 1).replace(/^ /, '');
      if (field === 'id') evt.id = value;
      else if (field === 'event') evt.event = value;
      else if (field === 'data') evt.data = (evt.data ? evt.data + '\n' : '') + value;
    }
    if (evt.data !== undefined) events.push(evt);
  }
  return { events, rest };
}

export type TailOptions = {
  daemonUrl: string; token: string; as?: string; chat?: string;
  station?: string; includeWebhooks?: boolean;
};

type Status = 'idle' | 'connecting' | 'open' | 'error' | 'closed';

/** Hook: open SSE to `/api/tail`, accumulate events newest-first. Caller toggles `enabled`. */
export function useTail(opts: TailOptions, enabled: boolean): {
  events: HistoryEntry[]; status: Status; error: string | null; reconnect: () => void;
} {
  const [events, setEvents] = useState<HistoryEntry[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const reconnect = useCallback(() => { setEvents([]); setTick(t => t + 1); }, []);

  useEffect(() => {
    if (!enabled || !opts.daemonUrl || !opts.token) { setStatus('idle'); return; }
    setStatus('connecting'); setError(null);

    /** Seed from /api/state — /api/tail defaults to since=tail so only NEW events stream. */
    void fetchState(opts.daemonUrl, opts.token).then(r => {
      if (!r.ok) return;
      const seed = (r.data as { recent_history?: HistoryEntry[] }).recent_history ?? [];
      const filtered = seed.filter(e =>
        !(opts.chat && e.line !== opts.chat)
        && !(opts.station && e.station !== opts.station)
        && !(!opts.includeWebhooks && e.station === 'webhook'),
      );
      if (!filtered.length) return;
      setEvents(prev => {
        const seen = new Set(prev.map(e => e.id));
        return [...filtered.filter(e => !seen.has(e.id)), ...prev].slice(0, 500);
      });
    });

    const params = new URLSearchParams();
    if (opts.as) params.set('as', opts.as);
    if (opts.chat) params.set('chat', opts.chat);
    if (opts.station) params.set('station', opts.station);
    if (opts.includeWebhooks) params.set('include_webhooks', 'true');
    const qs = params.toString();
    const url = `${opts.daemonUrl.replace(/\/$/, '')}/api/tail${qs ? `?${qs}` : ''}`;

    /** XHR + progress events — RN/Expo-Go fetch streaming fails on Android through Cloudflare. */
    const xhr = new XMLHttpRequest();
    let lastIndex = 0;
    let buf = '';
    let aborted = false;

    xhr.open('GET', url);
    xhr.setRequestHeader('Authorization', `Bearer ${opts.token}`);
    xhr.responseType = 'text';

    xhr.onreadystatechange = (): void => {
      if (aborted) return;
      if (xhr.readyState !== XMLHttpRequest.HEADERS_RECEIVED) return;
      if (xhr.status >= 200 && xhr.status < 300) setStatus('open');
      else { setStatus('error'); setError(`HTTP ${xhr.status}`); }
    };
    xhr.onprogress = (): void => {
      if (aborted) return;
      buf += xhr.responseText.slice(lastIndex);
      lastIndex = xhr.responseText.length;
      const { events: parsed, rest } = parseFrames(buf);
      buf = rest;
      const entries: HistoryEntry[] = [];
      for (const e of parsed) {
        if (e.event !== 'history' || !e.data) continue;
        try { entries.push(JSON.parse(e.data) as HistoryEntry); } catch { /* skip malformed */ }
      }
      if (entries.length) setEvents(prev => [...entries.reverse(), ...prev].slice(0, 500));
    };
    /** Cloudflare's free tier closes idle SSE streams after a couple of minutes; reconnect with
     *  a short backoff so the user sees a fresh stream within ~1s of any drop. */
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleReconnect = (delayMs: number): void => {
      if (aborted || reconnectTimer) return;
      reconnectTimer = setTimeout(() => { reconnectTimer = null; if (!aborted) setTick(t => t + 1); }, delayMs);
    };

    xhr.onerror = (): void => {
      if (aborted) return;
      setStatus('error'); setError('XHR network error');
      scheduleReconnect(2000);
    };
    xhr.onload = (): void => {
      if (aborted) return;
      setStatus('closed');
      scheduleReconnect(1000);
    };
    xhr.send();

    /** Foregrounding the app is a strong "you might have missed messages" signal — force-reconnect. */
    const appSub = AppState.addEventListener('change', state => {
      if (state === 'active' && !aborted) {
        try { xhr.abort(); } catch { /* ignore */ }
        scheduleReconnect(50);
      }
    });

    return (): void => {
      aborted = true;
      try { xhr.abort(); } catch { /* ignore */ }
      if (reconnectTimer) clearTimeout(reconnectTimer);
      appSub.remove();
    };
  }, [enabled, opts.daemonUrl, opts.token, opts.as, opts.chat, opts.station, opts.includeWebhooks, tick]);

  return { events, status, error, reconnect };
}

type JsonResult = { ok: true; data: unknown } | { ok: false; status: number; error: string };

/** Bearer-authed GET → JSON. XHR for RN/Expo-Go Android reliability. */
function getJson(url: string, token: string): Promise<JsonResult> {
  return new Promise(resolve => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.onload = (): void => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve({ ok: true, data: JSON.parse(xhr.responseText) }); }
        catch (e) { resolve({ ok: false, status: 0, error: e instanceof Error ? e.message : String(e) }); }
      } else resolve({ ok: false, status: xhr.status, error: `HTTP ${xhr.status}` });
    };
    xhr.onerror = (): void => resolve({ ok: false, status: 0, error: 'XHR error (network)' });
    xhr.ontimeout = (): void => resolve({ ok: false, status: 0, error: 'XHR timeout' });
    xhr.timeout = 15000;
    xhr.send();
  });
}

/** One-shot GET for `/api/state`. */
export function fetchState(daemonUrl: string, token: string): Promise<JsonResult> {
  return getJson(`${daemonUrl.replace(/\/$/, '')}/api/state`, token);
}

/** Fetch an older page of history via `/api/state?before=N&limit=M`. Newest-first. */
export async function fetchHistoryPage(
  daemonUrl: string, token: string, before: number, limit: number,
): Promise<{ ok: true; entries: HistoryEntry[] } | { ok: false; status: number; error: string }> {
  const r = await getJson(`${daemonUrl.replace(/\/$/, '')}/api/state?before=${before}&limit=${limit}`, token);
  if (!r.ok) return r;
  return { ok: true, entries: (r.data as { recent_history?: HistoryEntry[] }).recent_history ?? [] };
}
