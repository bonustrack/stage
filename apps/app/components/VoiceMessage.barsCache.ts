
import { useEffect, useState } from 'react';
import { decodeWaveformBars } from './VoiceMessage.decode';

type Entry = number[] | false;

const cache = new Map<string, Entry>();
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
