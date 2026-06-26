
import { ref, type Ref } from 'vue';
import { markConvReadSynced, markConvUnreadSynced } from './xmtp';
import {
  applyRead, applyUnread, applyConsent,
  type CachedChannelRow,
} from '@stage-labs/client/xmtp/channelsCache';

export type CachedRow = CachedChannelRow;

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
  const next = applyRead(cachedRows.value, convId, nowNs);
  if (next === null) return;
  setCachedRows(next);
}

export function markConvUnread(convId: string): void {
  void markConvUnreadSynced(convId);
  if (!cachedRows.value) return;
  const next = applyUnread(cachedRows.value, convId);
  if (next === null) return;
  setCachedRows(next);
}

export function applyConsentToRows(convId: string, markedUnread: boolean): void {
  if (!cachedRows.value) return;
  const next = applyConsent(cachedRows.value, convId, markedUnread);
  if (next === null) return;
  setCachedRows(next);
}
