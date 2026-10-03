import type { SearchStateContent } from '@stage-labs/client/xmtp/readState';

export type FilterEdit = Partial<Pick<SearchStateContent, 'labels' | 'unreadOnly'>>;

export const EMPTY_SEARCH: SearchStateContent = { query: '', labels: [], unreadOnly: false, at: 0 };

export function editFilters(current: SearchStateContent, change: FilterEdit, now: number): SearchStateContent {
  return { ...current, ...change, at: Math.max(now, current.at + 1) };
}

export function receiveSearch(current: SearchStateContent, incoming: SearchStateContent): SearchStateContent {
  return incoming.at > current.at ? { ...incoming, query: current.query } : current;
}

export function restoreSearch(current: SearchStateContent, stored: SearchStateContent): SearchStateContent {
  return { ...receiveSearch(current, stored), query: current.query === '' ? stored.query : current.query };
}

export function syncedSearch(state: SearchStateContent): SearchStateContent {
  return { ...state, query: '' };
}

export function toggledLabel(labels: readonly string[], label: string): string[] {
  const key = label.toLowerCase();
  return labels.includes(key) ? labels.filter(l => l !== key) : [...labels, key].sort();
}
