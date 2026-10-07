import { useMemo } from 'react';
import { isRowCleared } from '@stage-labs/client/xmtp/readState';
import { SearchTopnavBar } from './SearchTopnavBar';
import { useWebTabRail } from '../lib/webLayout';
import { getPeerDisplayName, getPeerHandle } from '../lib/peerProfiles';
import { memberNames, searchFilterSources, searchQueryText, setSearchQueryText, type FilterScope } from './searchFilter.model';
import { homeRows } from './home/state';
import { subscribeCachedRows } from '../lib/channelsCache';
import { useStoreValue } from '../lib/storeCore';
import { useClearedChats } from '../lib/clearedChats';
import { useBoardOrder } from '../lib/boardOrder';
import { useChannelGroups } from '../lib/channelGroups';
import { configuredFieldOptions } from './channel/channelFieldOptions.model';

export function useSearchFilterSources(scope: FilterScope): ReturnType<typeof searchFilterSources> {
  const rows = useStoreValue(subscribeCachedRows, homeRows);
  const cleared = useClearedChats();
  const statusOrder = useBoardOrder();
  const categoryOrder = useChannelGroups().order;
  return useMemo(() => {
    const sources = searchFilterSources((rows ?? []).filter(row => !isRowCleared(cleared, row)), scope);
    return {
      ...sources,
      categories: configuredFieldOptions('category', sources.categories, categoryOrder),
      statuses: configuredFieldOptions('status', sources.statuses, statusOrder),
    };
  }, [rows, cleared, scope, statusOrder, categoryOrder]);
}

export function memberNamesOf(address: string): string[] {
  return memberNames(getPeerHandle(address), getPeerDisplayName(address));
}

export function FilterSearch({ query, setQuery, ...bar }: {
  query: string;
  setQuery: (query: string) => void;
} & Omit<React.ComponentProps<typeof SearchTopnavBar>, 'query' | 'setQuery' | 'inputProps' | 'placeholder' | 'field'>): React.ReactElement {
  const wide = useWebTabRail();
  return (
    <SearchTopnavBar
      {...bar} inline={!wide || bar.inline === true} field={!wide} persistent={wide} query={searchQueryText(query)}
      setQuery={text => { setQuery(setSearchQueryText(query, text)); }}
      inputProps={{ accessibilityLabel: 'Search' }}
    />
  );
}
