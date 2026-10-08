import { subscribePeerProfiles } from '@stage-labs/client/identity/peerProfiles';
import type { HomeViewContent } from '@stage-labs/client/xmtp/readState';
import { subscribeCachedRows } from '../../lib/channelsCache';
import { getClearedChats, primeClearedChats, subscribeClearedChats } from '../../lib/clearedChats';
import { getDraft, loadDrafts, subscribeDrafts } from '../../lib/drafts';
import { getBoardQuery, subscribeBoardQuery, useHomeView } from '../../lib/homeView';
import { getSearchState, primeSearchState, subscribeSearchState } from '../../lib/searchState';
import { useStoreValue } from '../../lib/storeCore';
import { memberNamesOf } from '../FilterSearch';
import { parseSearchFilter, searchRowMatcher } from '../searchFilter.model';
import { visibleUnreadCount } from './model';
import { homeRows } from './state';

function subscribeSources(onChange: () => void): () => void {
  const offs = [
    subscribeCachedRows(onChange), subscribeSearchState(onChange), subscribeBoardQuery(onChange),
    subscribeClearedChats(onChange), subscribeDrafts(onChange), subscribePeerProfiles(onChange),
  ];
  return () => { for (const off of offs) off(); };
}

function primeSources(): void {
  primeSearchState();
  primeClearedChats();
  void loadDrafts();
}

function unreadCountIn({ view, columnBy }: HomeViewContent): number {
  const search = getSearchState();
  const query = view === 'board' ? getBoardQuery() : search.query;
  return visibleUnreadCount({
    view, columnBy, rows: homeRows(), enabledLabels: new Set(search.labels), unreadOnly: search.unreadOnly,
    matches: searchRowMatcher(parseSearchFilter(query), memberNamesOf, getDraft),
    cleared: getClearedChats(),
  });
}

export function useVisibleUnreadCount(): number {
  const view = useHomeView();
  return useStoreValue(subscribeSources, () => unreadCountIn(view), primeSources);
}
