import { useMemo } from 'react';
import { isRowCleared } from '@stage-labs/client/xmtp/sync/clear';
import { SearchTopnavBar } from '../../SearchTopnavBar';
import { useWebTabRail } from '../../layout/webLayout';
import { getPeerDisplayName, getPeerHandle } from '../../../lib/peerProfiles';
import { memberNames, searchFilterSources, searchQueryText, setSearchQueryText, type FilterScope } from './searchFilter.model';
import { homeRows } from '../../../lib/messaging/homeRows';
import { subscribeCachedRows } from '../../../lib/channelsCache';
import { useStoreValue } from '../../../lib/storeCore';
import { useClearedChats } from '../../../lib/sync/clearedChats';
import { useGroupingOrders } from '../../../lib/groupingOrder';
import { groupingOrderOf } from '../../../lib/grouping.model';
import { configuredFieldOptions } from '../../channel/channelFieldOptions.model';

export function useSearchFilterSources(scope: FilterScope): ReturnType<typeof searchFilterSources> {
  const rows = useStoreValue(subscribeCachedRows, homeRows);
  const cleared = useClearedChats();
  const orders = useGroupingOrders();
  return useMemo(() => {
    const sources = searchFilterSources(
      (rows ?? []).filter((row) => !isRowCleared(cleared, row)),
      scope,
    );
    return {
      ...sources,
      categories: configuredFieldOptions('category', sources.categories, groupingOrderOf('category', orders)),
      statuses: configuredFieldOptions('status', sources.statuses, groupingOrderOf('status', orders)),
    };
  }, [rows, cleared, scope, orders]);
}

export function memberNamesOf(address: string): string[] {
  return memberNames(getPeerHandle(address), getPeerDisplayName(address));
}

export function FilterSearch({
  query,
  setQuery,
  ...bar
}: { query: string; setQuery: (query: string) => void } & Omit<
  React.ComponentProps<typeof SearchTopnavBar>,
  'query' | 'setQuery' | 'inputProps' | 'placeholder' | 'field'
>): React.ReactElement {
  const wide = useWebTabRail();
  return (
    <SearchTopnavBar
      {...bar}
      inline={!wide || bar.inline === true}
      field={!wide}
      persistent={wide}
      query={searchQueryText(query)}
      setQuery={(text) => {
        setQuery(setSearchQueryText(query, text));
      }}
      inputProps={{ accessibilityLabel: 'Search' }}
    />
  );
}
