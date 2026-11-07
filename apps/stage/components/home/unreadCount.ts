import { subscribePeerProfiles } from '../../lib/peerProfiles';
import { getCachedRows, subscribeCachedRows } from '../../lib/channelsCache';
import { loadDrafts, subscribeDrafts } from '../../lib/drafts';
import { listingPrefsNow, primeListingPrefs, subscribeListingPrefs, useListingPrefs } from '../../lib/listingPrefs';
import { useStoreValue } from '../../lib/storeCore';
import { useActivityCutoff } from '../../lib/lastActivity';
import { listingMatcher } from './listing';
import { listedUnreadCount } from './listing.model';
import { reported } from '../../lib/errorPolicy';

function subscribeSources(onChange: () => void): () => void {
  const offs = [subscribeCachedRows(onChange), subscribeListingPrefs(onChange), subscribeDrafts(onChange), subscribePeerProfiles(onChange)];
  return () => {
    for (const off of offs) off();
  };
}

function primeSources(): void {
  primeListingPrefs();
  void loadDrafts().catch(reported('drafts.load'));
}

function chatsUnreadCount(activityCutoff: number | null): number | null {
  const prefs = listingPrefsNow();
  if (!prefs.settled) return null;
  const { search } = prefs;
  return listedUnreadCount({
    rows: getCachedRows(),
    enabledLabels: new Set(search.labels),
    unreadOnly: search.unreadOnly,
    matches: listingMatcher(search.query, activityCutoff),
    cleared: prefs.cleared,
  });
}

export function useVisibleUnreadCount(): number | null {
  const activityCutoff = useActivityCutoff(useListingPrefs().activity.chats);
  return useStoreValue(subscribeSources, () => chatsUnreadCount(activityCutoff), primeSources);
}
