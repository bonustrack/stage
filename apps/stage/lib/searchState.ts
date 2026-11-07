import { searchStateSchema, type SearchStateContent } from '@stage-labs/client/xmtp/sync/search';
import { syncedSetting } from './sync/setting';
import {
  EMPTY_SEARCH,
  editFilters,
  receiveSearch,
  restoreSearch,
  syncedSearch,
  toggledLabel,
  type FilterEdit,
} from './syncedSettings.model';

const search = syncedSetting<SearchStateContent>(
  { key: 'channels.search.', default: EMPTY_SEARCH, schema: searchStateSchema, perAccount: true, restore: restoreSearch },
  { receive: receiveSearch, synced: syncedSearch },
);
const { prefs } = search;

export const searchStateSync = search.sync;

export const useSearchState = prefs.use;

export const useSearchStateSettled = prefs.useSettled;

export const getSearchState = prefs.get;

export const subscribeSearchState = prefs.subscribe;

export const primeSearchState = prefs.loadAsync;

function editSynced(change: FilterEdit): void {
  search.edit((current) => editFilters(current, change, Date.now()));
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
