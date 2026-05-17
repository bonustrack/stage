/**
 * Tiny SSE reader.
 *
 * React Native's `fetch` returns a streamed response body via `.body` (a
 * web-style ReadableStream) on iOS/Android since RN 0.74. We use that
 * directly — no EventSource polyfill, no extra deps. Reconnects are caller-driven.
 */

import { useCallback, useEffect, useState } from 'react';
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
  daemonUrl: string;
  token: string;
  as?: string;
  chat?: string;
  station?: string;
  includeWebhooks?: boolean;
};

/**
 * React hook — opens an SSE stream to `/api/tail`, accumulates events newest-first,
 * exposes status + the list. Caller owns lifecycle via the `enabled` flag.
 */
export function useTail(opts: TailOptions, enabled: boolean): {
  events: HistoryEntry[];
  status: 'idle' | 'connecting' | 'open' | 'error' | 'closed';
  error: string | null;
  reconnect: () => void;
} {
  const [events, setEvents] = useState<HistoryEntry[]>([]);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'open' | 'error' | 'closed'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const reconnect = useCallback(() => {
    setEvents([]);
    setTick(t => t + 1);
  }, []);

  useEffect(() => {
    if (!enabled || !opts.daemonUrl || !opts.token) {
      setStatus('idle');
      return;
    }

    setStatus('connecting');
    setError(null);

    /**
     * Seed from /api/state so the user sees recent history immediately on open.
     * /api/tail defaults to `since=tail` (EOF) so it only emits NEW events.
     */
    void fetchState(opts.daemonUrl, opts.token).then(r => {
      if (!r.ok) return;
      const data = r.data as { recent_history?: HistoryEntry[] };
      const seed = data.recent_history ?? [];
      if (seed.length === 0) return;
      const filtered = seed.filter(e => {
        if (opts.chat && e.line !== opts.chat) return false;
        if (opts.station && e.station !== opts.station) return false;
        if (!opts.includeWebhooks && e.station === 'webhook') return false;
        return true;
      });
      /** Seed is already newest-first; merge in front (de-dup by id with the live stream). */
      setEvents(prev => {
        const seen = new Set(prev.map(e => e.id));
        const fresh = filtered.filter(e => !seen.has(e.id));
        return [...fresh, ...prev].slice(0, 500);
      });
    });

    const params = new URLSearchParams();
    if (opts.as) params.set('as', opts.as);
    if (opts.chat) params.set('chat', opts.chat);
    if (opts.station) params.set('station', opts.station);
    if (opts.includeWebhooks) params.set('include_webhooks', 'true');
    const qs = params.toString();
    const url = `${opts.daemonUrl.replace(/\/$/, '')}/api/tail${qs ? `?${qs}` : ''}`;

    /**
     * Uses XMLHttpRequest with `responseType: 'text'` and progress events —
     * RN/Expo-Go fetch streaming is broken on Android (rejects HTTP/2 from CF
     * with "Network request failed"). XHR is the reliable primitive on RN.
     */
    const xhr = new XMLHttpRequest();
    let lastIndex = 0;
    let buf = '';
    let aborted = false;

    xhr.open('GET', url);
    xhr.setRequestHeader('Authorization', `Bearer ${opts.token}`);
    xhr.responseType = 'text';

    xhr.onreadystatechange = (): void => {
      if (aborted) return;
      if (xhr.readyState === XMLHttpRequest.HEADERS_RECEIVED) {
        if (xhr.status >= 200 && xhr.status < 300) {
          setStatus('open');
        } else {
          setStatus('error');
          setError(`HTTP ${xhr.status}`);
        }
      }
    };
    xhr.onprogress = (): void => {
      if (aborted) return;
      const chunk = xhr.responseText.slice(lastIndex);
      lastIndex = xhr.responseText.length;
      buf += chunk;
      const { events: parsed, rest } = parseFrames(buf);
      buf = rest;
      if (parsed.length > 0) {
        const entries: HistoryEntry[] = [];
        for (const e of parsed) {
          if (e.event !== 'history' || !e.data) continue;
          try { entries.push(JSON.parse(e.data) as HistoryEntry); }
          catch { /* skip malformed */ }
        }
        if (entries.length > 0) {
          /** Newest-first, capped at 500 to keep the list bounded. */
          setEvents(prev => [...entries.reverse(), ...prev].slice(0, 500));
        }
      }
    };
    xhr.onerror = (): void => {
      if (aborted) return;
      setStatus('error');
      setError('XHR network error');
    };
    xhr.onload = (): void => {
      if (aborted) return;
      setStatus('closed');
    };
    xhr.send();

    return (): void => {
      aborted = true;
      try { xhr.abort(); } catch { /* ignore */ }
    };
  }, [enabled, opts.daemonUrl, opts.token, opts.as, opts.chat, opts.station, opts.includeWebhooks, tick]);

  return { events, status, error, reconnect };
}

/** One-shot GET helper for `/api/state` (no SSE). */
export async function fetchState(
  daemonUrl: string,
  token: string,
): Promise<{ ok: true; data: unknown } | { ok: false; status: number; error: string }> {
  /**
   * Uses XMLHttpRequest instead of fetch — RN/Expo-Go's `fetch` on Android
   * intermittently rejects HTTP/2 responses through Cloudflare with a generic
   * "Network request failed". XHR is the underlying primitive and is reliable.
   */
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', `${daemonUrl.replace(/\/$/, '')}/api/state`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.onload = (): void => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve({ ok: true, data: JSON.parse(xhr.responseText) }); }
        catch (e) { resolve({ ok: false, status: 0, error: e instanceof Error ? e.message : String(e) }); }
      } else {
        resolve({ ok: false, status: xhr.status, error: `HTTP ${xhr.status}` });
      }
    };
    xhr.onerror = (): void => { resolve({ ok: false, status: 0, error: 'XHR error (network)' }); };
    xhr.ontimeout = (): void => { resolve({ ok: false, status: 0, error: 'XHR timeout' }); };
    xhr.timeout = 15000;
    xhr.send();
  });
}
