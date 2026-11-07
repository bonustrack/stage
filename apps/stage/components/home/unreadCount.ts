import { subscribePeerProfiles } from '../../lib/peerProfiles';
import { getCachedRows, subscribeCachedRows } from '../../lib/channelsCache';
import { getClearedChats, primeClearedChats, subscribeClearedChats } from '../../lib/sync/clearedChats';
import { loadDrafts, subscribeDrafts } from '../../lib/drafts';
import { getSearchState, primeSearchState, subscribeSearchState } from '../../lib/searchState';
import { useStoreValue } from '../../lib/storeCore';
import { useLastActivityCutoff } from '../../lib/lastActivity';
import { listingMatcher } from './listing';
import { listedUnreadCount } from './listing.model';
import { reported } from '../../lib/errorPolicy';

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
  void loadDrafts().catch(reported('drafts.load'));
}

function chatsUnreadCount(activityCutoff: number | null): number {
  const search = getSearchState();
  return listedUnreadCount({
    rows: getCachedRows(),
    enabledLabels: new Set(search.labels),
    unreadOnly: search.unreadOnly,
    matches: listingMatcher(search.query, activityCutoff),
    cleared: getClearedChats(),
  });
}

export function useVisibleUnreadCount(): number {
  const activityCutoff = useLastActivityCutoff('chats');
  return useStoreValue(subscribeSources, () => chatsUnreadCount(activityCutoff), primeSources);
}
