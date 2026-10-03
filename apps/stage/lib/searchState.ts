import { searchStateSchema, type SearchStateContent } from '@stage-labs/client/xmtp/readState';
import { appStorage } from '../platform/storage';
import { getActiveAccount } from './accounts';
import { subscribeAccountEpoch } from './accountEpoch';
import { reported } from './errorPolicy';
import { makeListeners, useStoreValue } from './storeCore';
import {
  EMPTY_SEARCH_SLOT, editSearch, receiveSearch, settleSearch, toggledLabel, typingPause, type SearchEdit, type SearchSlot,
} from './searchState.model';

const KEY_PREFIX = 'channels.search.';

let accountId: string | null = null;
let slot: SearchSlot = EMPTY_SEARCH_SLOT;
let focused = false;
let lastEditAt = 0;
let settleTimer: ReturnType<typeof setTimeout> | null = null;
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

function commit(next: SearchSlot): void {
  const changed = next.current !== slot.current;
  slot = next;
  if (!changed) return;
  listeners.notify();
  if (accountId !== null) void persist(accountId, next.current).catch(reported('searchState.save'));
}

async function loadForActiveAccount(): Promise<void> {
  const id = (await getActiveAccount())?.id ?? null;
  if (id === accountId) return;
  const stored = id === null ? null : await storedSearch(id);
  const base = accountId === null ? slot : EMPTY_SEARCH_SLOT;
  accountId = id;
  slot = stored === null ? base : receiveSearch(base, stored, typing());
  listeners.notify();
  settleWhenIdle();
  await loadForActiveAccount();
}

function ensureLoaded(): Promise<void> {
  loading ??= loadForActiveAccount().finally(() => { loading = null; });
  return loading;
}

function primeSearchState(): void { void ensureLoaded().catch(reported('searchState.load')); }

subscribeAccountEpoch(primeSearchState);

function pauseMs(): number { return typingPause(focused, lastEditAt, Date.now()); }

function typing(): boolean { return pauseMs() > 0; }

function settleWhenIdle(): void {
  if (settleTimer !== null) clearTimeout(settleTimer);
  settleTimer = null;
  if (slot.pending === null) return;
  const wait = pauseMs();
  if (wait === 0) commit(settleSearch(slot));
  else settleTimer = setTimeout(settleWhenIdle, wait);
}

function edit(change: SearchEdit): void {
  lastEditAt = Date.now();
  commit(editSearch(slot, change, lastEditAt));
  if (accountId !== null) localChanges.notify({ accountId, state: slot.current });
}

export function setSearchQuery(query: string): void {
  if (query !== slot.current.query) edit({ query });
}

export function toggleSearchLabel(label: string): void {
  edit({ labels: toggledLabel(slot.current.labels, label) });
}

export function toggleSearchUnread(): void {
  edit({ unreadOnly: !slot.current.unreadOnly });
}

export function clearSearchFilters(): void {
  if (slot.current.labels.length > 0 || slot.current.unreadOnly) edit({ labels: [], unreadOnly: false });
}

export function setSearchFocused(next: boolean): void {
  focused = next;
  settleWhenIdle();
}

export const isSearchFocused = (): boolean => focused;

export async function applyRemoteSearchState(forAccount: string, incoming: SearchStateContent): Promise<void> {
  await ensureLoaded();
  if (forAccount === accountId) {
    commit(receiveSearch(slot, incoming, typing()));
    settleWhenIdle();
    return;
  }
  const stored = await storedSearch(forAccount);
  if (stored === null || incoming.at > stored.at) await persist(forAccount, incoming);
}

export async function loadSearchState(forAccount: string): Promise<SearchStateContent | null> {
  await ensureLoaded();
  if (forAccount !== accountId) return storedSearch(forAccount);
  return slot.current.at > 0 ? slot.current : null;
}

const getSearchState = (): SearchStateContent => slot.current;

export const useSearchState = (): SearchStateContent => useStoreValue(listeners.subscribe, getSearchState, primeSearchState);
