import { useMemo, useState } from 'react';
import type { HomeViewContent } from '@stage-labs/client/xmtp/sync/homeView';
import { usePersistedScroll, type PersistedScroll } from '../layout';
import { useListingPrefs } from '../../lib/listingPrefs';
import { groupRows, rowsOf, type HomeListItem } from './groups.model';
import type { NameOf } from './groupBy.model';
import { CHANNELS_SCROLL_KEY } from '../../lib/scrollPos';
import type { RowMenu } from '../chatRow/chatRow';
import type { CachedRow } from '../../lib/cachedRows.model';

interface HomeState {
  rowMenu: RowMenu | null;
  setRowMenu: React.Dispatch<React.SetStateAction<RowMenu | null>>;
  scroll: PersistedScroll;
}

export function useHomeState(): HomeState {
  const [rowMenu, setRowMenu] = useState<RowMenu | null>(null);
  const scroll = usePersistedScroll(CHANNELS_SCROLL_KEY);
  return { rowMenu, setRowMenu, scroll };
}

interface GroupedRows {
  grouped: boolean;
  items: HomeListItem[];
  rows: CachedRow[];
}

export function useGroupedRows(
  visibleRows: CachedRow[],
  searchText: string,
  groupBy: HomeViewContent['groupBy'],
  nameOf: NameOf,
  namesVersion: number,
): GroupedRows {
  const { collapsed, order } = useListingPrefs().groups;
  return useMemo(() => {
    if (groupBy === 'none') return { grouped: false, items: visibleRows, rows: visibleRows };
    const items = groupRows(visibleRows, groupBy, new Set(collapsed), searchText !== '', nameOf, order);
    return { grouped: true, items, rows: rowsOf(items) };
  }, [groupBy, collapsed, order, visibleRows, searchText, nameOf, namesVersion]);
}
