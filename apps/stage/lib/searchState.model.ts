import type { SearchStateContent } from '@stage-labs/client/xmtp/readState';

export interface SearchSlot {
  current: SearchStateContent;
  pending: SearchStateContent | null;
}

export type SearchEdit = Partial<Omit<SearchStateContent, 'at'>>;

const EMPTY_SEARCH: SearchStateContent = { query: '', labels: [], unreadOnly: false, at: 0 };

export const EMPTY_SEARCH_SLOT: SearchSlot = { current: EMPTY_SEARCH, pending: null };

function latestSeen(slot: SearchSlot): number {
  return Math.max(slot.current.at, slot.pending?.at ?? 0);
}

export function editSearch(slot: SearchSlot, change: SearchEdit, now: number): SearchSlot {
  return { current: { ...slot.current, ...change, at: Math.max(now, latestSeen(slot) + 1) }, pending: null };
}

export const TYPING_IDLE_MS = 2000;

export function typingPause(focused: boolean, lastEditAt: number, now: number): number {
  return focused ? Math.max(0, lastEditAt + TYPING_IDLE_MS - now) : 0;
}

export function receiveSearch(slot: SearchSlot, incoming: SearchStateContent, typing: boolean): SearchSlot {
  if (incoming.at <= latestSeen(slot)) return slot;
  return typing ? { current: slot.current, pending: incoming } : { current: incoming, pending: null };
}

export function settleSearch(slot: SearchSlot): SearchSlot {
  return slot.pending === null ? slot : { current: slot.pending, pending: null };
}

export function toggledLabel(labels: readonly string[], label: string): string[] {
  const key = label.toLowerCase();
  return labels.includes(key) ? labels.filter(l => l !== key) : [...labels, key].sort();
}
