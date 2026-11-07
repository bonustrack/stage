import { useMemo } from 'react';
import { isRowCleared, type ClearedChats } from '@stage-labs/client/xmtp/sync/clear';
import type { HomeSort, HomeViewContent } from '@stage-labs/client/xmtp/sync/homeView';
import { useHomeRows } from '../../lib/messaging/homeRows';
import type { CachedRow } from '../../lib/cachedRows.model';
import { getPeerDisplayName, getPeerHandle, usePeerProfiles } from '../../lib/peerProfiles';
import { getDraft, useDraftsVersion } from '../../lib/drafts';
import { homeViewOf, type HomeView } from '../../lib/homeView';
import { useActivityCutoff } from '../../lib/lastActivity';
import { setSearchQuery, useSearchState } from '../../lib/searchState';
import { useListingPrefs, type ListingPrefs } from '../../lib/listingPrefs';
import type { ChannelFields } from '../../lib/channelFields.model';
import { groupingOrderOf, type GroupingOrders } from '../../lib/grouping.model';
import { makeValue } from '../../lib/storeCore';
import { configuredFieldOptions } from '../channel/channelFieldOptions.model';
import { homeSortOf } from './sort.model';
import {
  memberNames,
  parseSearchFilter,
  searchFilterSources,
  searchFilterValues,
  searchRowMatcher,
  type FilterRow,
} from './search/searchFilter.model';

export function memberNamesOf(address: string): string[] {
  return memberNames(getPeerHandle(address), getPeerDisplayName(address));
}

export function listingMatcher(query: string, activityCutoff: number | null): (row: FilterRow) => boolean {
  return searchRowMatcher(parseSearchFilter(query), memberNamesOf, getDraft, activityCutoff);
}

const boardQuery = makeValue('');

export const resetBoardQuery = (): void => {
  boardQuery.set('');
};

type HomeQuery = [string, (query: string) => void];

function homeQuery(view: HomeView, chats: string, board: string): HomeQuery {
  return view === 'board' ? [board, boardQuery.set] : [chats, setSearchQuery];
}

export function useHomeQuery(view: HomeView): HomeQuery {
  return homeQuery(view, useSearchState().query, boardQuery.use());
}

function useGroupingOrders(prefs: ListingPrefs): GroupingOrders {
  const categories = prefs.groups.order;
  const board = prefs.boardOrder;
  return useMemo(() => ({ categories, board }), [categories, board]);
}

function profileAddresses(view: HomeView, rows: readonly CachedRow[], members: readonly string[], byAssignee: boolean): (string | null)[] {
  if (view === 'board')
    return [...rows.map((r) => r.lastSenderAddress), ...members, ...(byAssignee ? rows.flatMap((r) => r.assigned) : [])];
  return [...members, ...rows.flatMap((r) => [r.avatarAddress, r.peerAddress, r.lastSenderAddress, ...(byAssignee ? r.assigned : [])])];
}

export interface HomeListing {
  rows: CachedRow[] | null;
  pinned: readonly string[];
  cleared: ClearedChats;
  view: HomeViewContent;
  sort: HomeSort;
  orders: GroupingOrders;
  enabledLabels: Set<string>;
  unreadOnly: boolean;
  fields: ChannelFields;
  query: string;
  setQuery: (query: string) => void;
  searchText: string;
  matches: (row: FilterRow) => boolean;
  profilesVersion: number;
  draftsVersion: number;
}

export function useHomeListing(view: HomeView): HomeListing {
  const prefs = useListingPrefs();
  const storedRows = useHomeRows();
  const rows = prefs.settled ? storedRows : null;
  const viewPrefs = useMemo(() => homeViewOf(prefs.homeView, view), [prefs.homeView, view]);
  const orders = useGroupingOrders(prefs);
  const { labels, unreadOnly } = prefs.search;
  const enabledLabels = useMemo(() => new Set(labels), [labels]);
  const [query, setQuery] = homeQuery(view, prefs.search.query, boardQuery.use());
  const grouping = view === 'board' ? viewPrefs.columnBy : viewPrefs.groupBy;
  const members = searchFilterValues(query, 'member').length > 0 ? searchFilterSources(rows ?? [], view).members : [];
  const profilesVersion = usePeerProfiles(profileAddresses(view, rows ?? [], members, grouping === 'assignee'));
  const draftsVersion = useDraftsVersion();
  const activityCutoff = useActivityCutoff(prefs.activity[view]);
  const searchText = useMemo(() => parseSearchFilter(query).text, [query]);
  const matches = useMemo(() => listingMatcher(query, activityCutoff), [query, profilesVersion, draftsVersion, activityCutoff]);
  return {
    rows,
    pinned: prefs.pinned,
    cleared: prefs.cleared,
    view: viewPrefs,
    sort: homeSortOf(viewPrefs),
    orders,
    enabledLabels,
    unreadOnly,
    fields: prefs.fields[view],
    query,
    setQuery,
    searchText,
    matches,
    profilesVersion,
    draftsVersion,
  };
}

export function useKnownFieldValues(view: HomeView): ReturnType<typeof searchFilterSources> {
  const rows = useHomeRows();
  const prefs = useListingPrefs();
  const orders = useGroupingOrders(prefs);
  const { cleared } = prefs;
  return useMemo(() => {
    const kept = (rows ?? []).filter((row) => !isRowCleared(cleared, row));
    const sources = searchFilterSources(kept, view);
    return {
      ...sources,
      categories: configuredFieldOptions('category', sources.categories, groupingOrderOf('category', orders)),
      statuses: configuredFieldOptions('status', sources.statuses, groupingOrderOf('status', orders)),
    };
  }, [rows, cleared, view, orders]);
}
