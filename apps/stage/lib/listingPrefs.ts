import type { StoreSource } from './persistedStore';
import { useStoreValue } from './storeCore';
import { pinnedOrderSource } from './sync/pins';
import { clearedChatsSource } from './sync/clearedChats';
import { homeViewSource } from './homeView';
import { lastActivitySource } from './lastActivity';
import { searchStateSource } from './searchState';
import { channelGroupsSource } from './channelGroups';
import { boardOrderSource } from './boardOrder';
import { channelFieldsSource } from './channelFields';

const SOURCES = {
  pinned: pinnedOrderSource,
  cleared: clearedChatsSource,
  homeView: homeViewSource,
  activity: lastActivitySource,
  search: searchStateSource,
  groups: channelGroupsSource,
  boardOrder: boardOrderSource,
  fields: channelFieldsSource,
};

type Sources = typeof SOURCES;

type SourceValues<S> = { readonly [K in keyof S]: S[K] extends StoreSource<infer T> ? T : never };

export type ListingPrefs = SourceValues<Sources> & { settled: boolean };

const STORES: readonly StoreSource<unknown>[] = Object.values(SOURCES);

function valuesOf<V>(sources: { [K in keyof V]: StoreSource<V[K]> }): V {
  const values: Partial<V> = {};
  for (const key of Object.keys(sources) as (keyof V)[]) values[key] = sources[key].get();
  return values as V;
}

let last: { values: readonly unknown[]; prefs: ListingPrefs } | null = null;

export function listingPrefsNow(): ListingPrefs {
  const values = STORES.map((store) => store.get());
  const settled = STORES.every((store) => store.settled());
  const known = last;
  if (known !== null && known.prefs.settled === settled && values.every((value, i) => value === known.values[i])) return known.prefs;
  const prefs: ListingPrefs = { ...valuesOf<SourceValues<Sources>>(SOURCES), settled };
  last = { values, prefs };
  return prefs;
}

export function subscribeListingPrefs(onChange: () => void): () => void {
  const offs = STORES.map((store) => store.subscribe(onChange));
  return () => {
    for (const off of offs) off();
  };
}

export function primeListingPrefs(): void {
  for (const store of STORES) store.loadAsync();
}

export function useListingPrefs(): ListingPrefs {
  return useStoreValue(subscribeListingPrefs, listingPrefsNow, primeListingPrefs);
}
