/** Tiny cache of the latest messenger bubbles so the feed isn't empty for a frame on cold open.
 *  SecureStore is overkill for non-secret data but it's already installed and works for this size. */

import { useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import type { HistoryEntry } from './types';

const KEY = 'messenger-cache-v1';
const MAX_ENTRIES = 60;
let memCache: HistoryEntry[] | null = null;

void SecureStore.getItemAsync(KEY)
  .then(v => { if (v) { try { memCache = JSON.parse(v) as HistoryEntry[]; } catch { /* ignore */ } } })
  .catch(() => { /* first-launch — no cache yet */ });

export function useCachedBubbles(): HistoryEntry[] {
  const [bubbles, setBubbles] = useState<HistoryEntry[]>(() => memCache ?? []);
  useEffect(() => {
    if (memCache && bubbles.length === 0) setBubbles(memCache);
  }, [bubbles.length]);
  return bubbles;
}

export function saveBubbleCache(entries: HistoryEntry[]): void {
  const slice = entries.slice(0, MAX_ENTRIES);
  memCache = slice;
  void SecureStore.setItemAsync(KEY, JSON.stringify(slice)).catch(() => { /* ignore */ });
}
