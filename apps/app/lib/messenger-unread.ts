/** Tiny unread-counter for the Messenger tab. Stores `lastReadAt` in SecureStore,
 * counts messenger entries from the other side newer than it. Subscribers re-render on change. */

import { useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import type { HistoryEntry } from './types';

const KEY = 'messenger-last-read-iso';
const MESSENGER_USER = 'metro://messenger/user/owner';
let lastReadIso: string = new Date(0).toISOString();
const listeners = new Set<(iso: string) => void>();

void SecureStore.getItemAsync(KEY).then(v => {
  if (v) { lastReadIso = v; listeners.forEach(l => l(lastReadIso)); }
});

export async function markMessengerRead(): Promise<void> {
  lastReadIso = new Date().toISOString();
  listeners.forEach(l => l(lastReadIso));
  await SecureStore.setItemAsync(KEY, lastReadIso).catch(() => { /* ignore */ });
}

export function getMessengerLastRead(): string { return lastReadIso; }

export function useMessengerUnread(events: HistoryEntry[]): number {
  const [lastRead, setLastRead] = useState(lastReadIso);
  useEffect(() => {
    listeners.add(setLastRead);
    return (): void => { listeners.delete(setLastRead); };
  }, []);
  /** Messages from the other side (not the local user), on the messenger line, newer than last read.
   *  Skip reactions + transcripts — they decorate other messages, not stand-alone unread items. */
  return events.filter(e => {
    if (e.from === MESSENGER_USER || e.station !== 'messenger' || e.ts <= lastRead) return false;
    const p = e.payload as { reactTo?: string; transcribeFor?: string } | undefined;
    if (p?.reactTo || p?.transcribeFor) return false;
    return true;
  }).length;
}
