import { useMemo } from 'react';
import { isRowCleared, type ClearedChats } from '@stage-labs/client/xmtp/sync/clear';
import type { HomeSort, HomeViewContent } from '@stage-labs/client/xmtp/sync/homeView';
import { useHomeRows, type HomeRow } from '../../lib/messaging/homeRows';
import { usePinnedOrder } from '../../lib/sync/pins';
import { useClearedChats } from '../../lib/sync/clearedChats';
import { getPeerDisplayName, getPeerHandle, usePeerProfiles } from '../../lib/peerProfiles';
import { getDraft, useDraftsVersion } from '../../lib/drafts';
import { useHomeViewOf, type HomeView } from '../../lib/homeView';
import { useLastActivityCutoff } from '../../lib/lastActivity';
import { setSearchQuery, useSearchState } from '../../lib/searchState';
import { useGroupingOrders } from '../../lib/groupingOrder';
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

export function useHomeQuery(view: HomeView): [string, (query: string) => void] {
  const chats = useSearchState().query;
  const board = boardQuery.use();
  return view === 'board' ? [board, boardQuery.set] : [chats, setSearchQuery];
}

function profileAddresses(view: HomeView, rows: readonly HomeRow[], members: readonly string[], byAssignee: boolean): (string | null)[] {
  if (view === 'board')
    return [...rows.map((r) => r.lastSenderAddress), ...members, ...(byAssignee ? rows.flatMap((r) => r.assigned) : [])];
  return [...members, ...rows.flatMap((r) => [r.avatarAddress, r.peerAddress, r.lastSenderAddress, ...(byAssignee ? r.assigned : [])])];
}

export interface HomeListing {
  rows: HomeRow[] | null;
  pinned: readonly string[];
  cleared: ClearedChats;
  view: HomeViewContent;
  sort: HomeSort;
  orders: GroupingOrders;
  query: string;
  setQuery: (query: string) => void;
  searchText: string;
  matches: (row: FilterRow) => boolean;
  profilesVersion: number;
  draftsVersion: number;
}

export function useHomeListing(view: HomeView): HomeListing {
  const rows = useHomeRows();
  const pinned = usePinnedOrder();
  const cleared = useClearedChats();
  const prefs = useHomeViewOf(view);
  const orders = useGroupingOrders();
  const [query, setQuery] = useHomeQuery(view);
  const grouping = view === 'board' ? prefs.columnBy : prefs.groupBy;
  const members = searchFilterValues(query, 'member').length > 0 ? searchFilterSources(rows ?? [], view).members : [];
  const profilesVersion = usePeerProfiles(profileAddresses(view, rows ?? [], members, grouping === 'assignee'));
  const draftsVersion = useDraftsVersion();
  const activityCutoff = useLastActivityCutoff(view);
  const searchText = useMemo(() => parseSearchFilter(query).text, [query]);
  const matches = useMemo(() => listingMatcher(query, activityCutoff), [query, profilesVersion, draftsVersion, activityCutoff]);
  return {
    rows,
    pinned,
    cleared,
    view: prefs,
    sort: homeSortOf(prefs),
    orders,
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
  const cleared = useClearedChats();
  const orders = useGroupingOrders();
  return useMemo(() => {
    const sources = searchFilterSources(
      (rows ?? []).filter((row) => !isRowCleared(cleared, row)),
      view,
    );
    return {
      ...sources,
      categories: configuredFieldOptions('category', sources.categories, groupingOrderOf('category', orders)),
      statuses: configuredFieldOptions('status', sources.statuses, groupingOrderOf('status', orders)),
    };
  }, [rows, cleared, view, orders]);
}
