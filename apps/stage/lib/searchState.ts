import { searchStateSchema, type SearchStateContent } from '@stage-labs/client/xmtp/readState';
import { createValueStore } from './persistedStore';
import { makeListeners } from './storeCore';
import {
  EMPTY_SEARCH, editFilters, receiveSearch, restoreSearch, syncedSearch, toggledLabel, type FilterEdit,
} from './syncedSettings.model';

function parseSearch(raw: string): SearchStateContent | undefined {
  try {
    const parsed = searchStateSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : undefined;
  } catch { return undefined; }
}

const prefs = createValueStore<SearchStateContent>({
  key: 'channels.search.', default: EMPTY_SEARCH, deserialize: parseSearch, serialize: JSON.stringify,
  perAccount: true, restore: restoreSearch,
});

export const useSearchState = prefs.use;

export interface SearchStateChange {
  accountId: string;
  state: SearchStateContent;
}

const localChanges = makeListeners<SearchStateChange>();
export const onSearchStateChanged = localChanges.subscribe;

function editSynced(change: FilterEdit): void {
  prefs.set(editFilters(prefs.get(), change, Date.now()));
  const accountId = prefs.accountId();
  if (accountId !== null) localChanges.notify({ accountId, state: syncedSearch(prefs.get()) });
}

export function setSearchQuery(query: string): void {
  const current = prefs.get();
  if (query !== current.query) prefs.set({ ...current, query });
}

export function toggleSearchLabel(label: string): void {
  editSynced({ labels: toggledLabel(prefs.get().labels, label) });
}

export function toggleSearchUnread(): void {
  editSynced({ unreadOnly: !prefs.get().unreadOnly });
}

export function clearSearchFilters(): void {
  const current = prefs.get();
  if (current.labels.length > 0 || current.unreadOnly) editSynced({ labels: [], unreadOnly: false });
}

export function applyRemoteSearchState(forAccount: string, incoming: SearchStateContent): Promise<void> {
  return prefs.updateFor(forAccount, current => receiveSearch(current, incoming));
}

export async function loadSearchState(forAccount: string): Promise<SearchStateContent | null> {
  const state = await prefs.loadFor(forAccount);
  return state.at === 0 ? null : syncedSearch(state);
}
