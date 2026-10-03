import { searchStateSchema, type SearchStateContent } from '@stage-labs/client/xmtp/readState';
import { appStorage } from '../platform/storage';
import { getActiveAccount } from './accounts';
import { subscribeAccountEpoch } from './accountEpoch';
import { reported } from './errorPolicy';
import { makeListeners, useStoreValue } from './storeCore';
import {
  EMPTY_SEARCH, editFilters, receiveSearch, restoreSearch, syncedSearch, toggledLabel, type FilterEdit,
} from './searchState.model';

const KEY_PREFIX = 'channels.search.';

let accountId: string | null = null;
let current: SearchStateContent = EMPTY_SEARCH;
let focused = false;
let loading: Promise<void> | null = null;
const listeners = makeListeners();

export interface SearchStateChange {
  accountId: string;
  state: SearchStateContent;
}

const localChanges = makeListeners<SearchStateChange>();
export const onSearchStateChanged = localChanges.subscribe;

function parseSearch(raw: string | null): SearchStateContent | null {
  if (raw === null) return null;
  try {
    const parsed = searchStateSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch { return null; }
}

async function storedSearch(id: string): Promise<SearchStateContent | null> {
  return parseSearch(await appStorage.get(KEY_PREFIX + id));
}

function persist(id: string, state: SearchStateContent): Promise<void> {
  return appStorage.set(KEY_PREFIX + id, JSON.stringify(state));
}

function commit(next: SearchStateContent): void {
  if (next === current) return;
  current = next;
  listeners.notify();
  if (accountId !== null) void persist(accountId, next).catch(reported('searchState.save'));
}

async function loadForActiveAccount(): Promise<void> {
  const id = (await getActiveAccount())?.id ?? null;
  if (id === accountId) return;
  const stored = id === null ? null : await storedSearch(id);
  const base = accountId === null ? current : EMPTY_SEARCH;
  accountId = id;
  current = stored === null ? base : restoreSearch(base, stored);
  listeners.notify();
  await loadForActiveAccount();
}

function ensureLoaded(): Promise<void> {
  loading ??= loadForActiveAccount().finally(() => { loading = null; });
  return loading;
}

function primeSearchState(): void { void ensureLoaded().catch(reported('searchState.load')); }

subscribeAccountEpoch(primeSearchState);

function editSynced(change: FilterEdit): void {
  commit(editFilters(current, change, Date.now()));
  if (accountId !== null) localChanges.notify({ accountId, state: syncedSearch(current) });
}

export function setSearchQuery(query: string): void {
  if (query !== current.query) commit({ ...current, query });
}

export function toggleSearchLabel(label: string): void {
  editSynced({ labels: toggledLabel(current.labels, label) });
}

export function toggleSearchUnread(): void {
  editSynced({ unreadOnly: !current.unreadOnly });
}

export function clearSearchFilters(): void {
  if (current.labels.length > 0 || current.unreadOnly) editSynced({ labels: [], unreadOnly: false });
}

export function setSearchFocused(next: boolean): void {
  focused = next;
}

export const isSearchFocused = (): boolean => focused;

export async function applyRemoteSearchState(forAccount: string, incoming: SearchStateContent): Promise<void> {
  await ensureLoaded();
  if (forAccount === accountId) {
    commit(receiveSearch(current, incoming));
    return;
  }
  const stored = await storedSearch(forAccount);
  const next = receiveSearch(stored ?? EMPTY_SEARCH, incoming);
  if (next !== stored) await persist(forAccount, next);
}

export async function loadSearchState(forAccount: string): Promise<SearchStateContent | null> {
  await ensureLoaded();
  const state = forAccount === accountId ? current : await storedSearch(forAccount);
  return state === null || state.at === 0 ? null : syncedSearch(state);
}

const getSearchState = (): SearchStateContent => current;

export const useSearchState = (): SearchStateContent => useStoreValue(listeners.subscribe, getSearchState, primeSearchState);
