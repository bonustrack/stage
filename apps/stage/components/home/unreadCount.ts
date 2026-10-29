import { subscribePeerProfiles } from '@stage-labs/client/identity/peerProfiles';
import { subscribeCachedRows } from '../../lib/channelsCache';
import { getClearedChats, primeClearedChats, subscribeClearedChats } from '../../lib/clearedChats';
import { getDraft, loadDrafts, subscribeDrafts } from '../../lib/drafts';
import { getSearchState, primeSearchState, subscribeSearchState } from '../../lib/searchState';
import { useStoreValue } from '../../lib/storeCore';
import { memberNamesOf } from '../FilterSearch';
import { parseSearchFilter, searchRowMatcher } from '../searchFilter.model';
import { visibleUnreadCount } from './model';
import { homeRows } from './state';
import { useLastActivityCutoff } from '../../lib/lastActivity';

function subscribeSources(onChange: () => void): () => void {
  const offs = [
    subscribeCachedRows(onChange),
    subscribeSearchState(onChange),
    subscribeClearedChats(onChange),
    subscribeDrafts(onChange),
    subscribePeerProfiles(onChange),
  ];
  return () => {
    for (const off of offs) off();
  };
}

function primeSources(): void {
  primeSearchState();
  primeClearedChats();
  void loadDrafts();
}

function chatsUnreadCount(activityCutoff: number | null): number {
  const search = getSearchState();
  return visibleUnreadCount({
    rows: homeRows(),
    enabledLabels: new Set(search.labels),
    unreadOnly: search.unreadOnly,
    matches: searchRowMatcher(parseSearchFilter(search.query), memberNamesOf, getDraft, activityCutoff),
    cleared: getClearedChats(),
  });
}

export function useVisibleUnreadCount(): number {
  const activityCutoff = useLastActivityCutoff('chats');
  return useStoreValue(subscribeSources, () => chatsUnreadCount(activityCutoff), primeSources);
}
