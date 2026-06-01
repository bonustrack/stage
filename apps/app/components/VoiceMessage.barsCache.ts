/** Per-clip cache + React hook for the TRUE decoded waveform bars. Decoding is
 *  async + relatively expensive, so we cache the result keyed by the clip's
 *  resolved uri (stable per message once its remote attachment is materialised)
 *  and never re-decode on re-render. While a decode is in flight the hook
 *  returns null; the player shows synthetic bars as a placeholder and swaps to
 *  the real ones when they resolve. Decode failure caches a sentinel so we
 *  don't retry a clip that can't be decoded. */

import { useEffect, useState } from 'react';
import { decodeWaveformBars } from './VoiceMessage.decode';

/** Resolved real bars, or `false` to mark a permanent decode failure (so the
 *  hook stays on synthetic bars without re-attempting). */
type Entry = number[] | false;

const cache = new Map<string, Entry>();
/** De-dupe concurrent decodes of the same uri (e.g. two bubbles, same clip). */
const inflight = new Map<string, Promise<Entry>>();

function decodeOnce(uri: string, count: number): Promise<Entry> {
  const existing = inflight.get(uri);
  if (existing) return existing;
  const p = decodeWaveformBars(uri, count)
    .then((bars): Entry => bars)
    .catch((): Entry => false)
    .then((entry) => { cache.set(uri, entry); inflight.delete(uri); return entry; });
  inflight.set(uri, p);
  return p;
}

/** Returns the decoded bars for `uri`, or null while decoding / on failure.
 *  Null signals the caller to render synthetic fallback bars. */
export function useDecodedBars(uri: string, count: number): number[] | null {
  const cached = cache.get(uri);
  const [bars, setBars] = useState<number[] | null>(
    Array.isArray(cached) ? cached : null,
  );

  useEffect(() => {
    let cancelled = false;
    const hit = cache.get(uri);
    if (Array.isArray(hit)) { setBars(hit); return; }
    if (hit === false) { setBars(null); return; }
    setBars(null);
    void decodeOnce(uri, count).then((entry) => {
      if (!cancelled) setBars(Array.isArray(entry) ? entry : null);
    });
    return () => { cancelled = true; };
  }, [uri, count]);

  return bars;
}
