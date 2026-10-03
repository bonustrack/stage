import {
  DEFAULT_HOME_VIEW, type HomeViewContent, type HomeViewEdit, type SearchStateContent,
} from '@stage-labs/client/xmtp/readState';

function stamped<T extends { at: number }>(current: T, change: Partial<NoInfer<T>>, now: number): T {
  return { ...current, ...change, at: Math.max(now, current.at + 1) };
}

function receiveKeeping<T extends { at: number }>(local: keyof T): (current: T, incoming: T) => T {
  return (current, incoming) => (incoming.at > current.at ? { ...incoming, [local]: current[local] } : current);
}

export type FilterEdit = Partial<Pick<SearchStateContent, 'labels' | 'unreadOnly'>>;

export const EMPTY_SEARCH: SearchStateContent = { query: '', labels: [], unreadOnly: false, at: 0 };

export function editFilters(current: SearchStateContent, change: FilterEdit, now: number): SearchStateContent {
  return stamped(current, change, now);
}

export const receiveSearch = receiveKeeping<SearchStateContent>('query');

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

export function syncsHomeView(edit: HomeViewEdit): boolean {
  return edit.groupBy !== undefined || edit.columnBy !== undefined;
}

export function editHomeView(current: HomeViewContent, edit: HomeViewEdit, now: number): HomeViewContent {
  return syncsHomeView(edit) ? stamped(current, edit, now) : { ...current, ...edit };
}

export const receiveHomeView = receiveKeeping<HomeViewContent>('view');

export function syncedHomeView(state: HomeViewContent): HomeViewContent {
  return { ...state, view: DEFAULT_HOME_VIEW.view };
}
