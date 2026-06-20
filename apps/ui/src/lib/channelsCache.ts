
import { ref, type Ref } from 'vue';
import { markConvReadSynced, markConvUnreadSynced } from './xmtp';

export interface CachedRow {
  convId: string;
  unreadCount: number;
  lastReadNs: number;
  markedUnread?: boolean;
  [key: string]: unknown;
}

const STORAGE_KEY = 'metro.channels.cache.v1';

export const cachedRows: Ref<CachedRow[] | null> = ref<CachedRow[] | null>(null);
let hydrated = false;

export function hydrateCachedRows(): CachedRow[] | null {
  if (hydrated) return cachedRows.value;
  hydrated = true;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return cachedRows.value;
    const parsed = JSON.parse(raw) as CachedRow[];
    if (Array.isArray(parsed)) cachedRows.value = parsed;
  } catch { }
  return cachedRows.value;
}

export function setCachedRows(next: CachedRow[] | null): void {
  cachedRows.value = next;
  try {
    if (next === null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch { }
}

export function markConvRead(convId: string): void {
  const nowNs = Date.now() * 1_000_000;
  void markConvReadSynced(convId);
  if (!cachedRows.value) return;
  const idx = cachedRows.value.findIndex(r => r.convId === convId);
  const cur = idx === -1 ? undefined : cachedRows.value[idx];
  if (cur === undefined) return;
  const next = [...cachedRows.value];
  next[idx] = { ...cur, unreadCount: 0, lastReadNs: nowNs, markedUnread: false };
  setCachedRows(next);
}

export function markConvUnread(convId: string): void {
  void markConvUnreadSynced(convId);
  if (!cachedRows.value) return;
  const idx = cachedRows.value.findIndex(r => r.convId === convId);
  const cur = idx === -1 ? undefined : cachedRows.value[idx];
  if (cur === undefined) return;
  const next = [...cachedRows.value];
  next[idx] = { ...cur, unreadCount: Math.max(1, cur.unreadCount), lastReadNs: 0, markedUnread: true };
  setCachedRows(next);
}

export function applyConsentToRows(convId: string, markedUnread: boolean): void {
  if (!cachedRows.value) return;
  const idx = cachedRows.value.findIndex(r => r.convId === convId);
  const cur = idx === -1 ? undefined : cachedRows.value[idx];
  if (cur === undefined) return;
  if (cur.markedUnread === markedUnread) return;
  const next = [...cachedRows.value];
  next[idx] = markedUnread
    ? { ...cur, markedUnread: true, unreadCount: Math.max(1, cur.unreadCount) }
    : { ...cur, markedUnread: false, unreadCount: 0 };
  setCachedRows(next);
}
