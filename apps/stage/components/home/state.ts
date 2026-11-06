import { useMemo, useState } from 'react';
import type { HomeViewContent } from '@stage-labs/client/xmtp/sync/homeView';
import { usePersistedScroll, type PersistedScroll } from '../layout';
import { useChannelGroups } from '../../lib/channelGroups';
import { usePinnedOrder } from '../../lib/sync/pins';
import { groupRows, rowsOf, type HomeListItem } from './groups.model';
import type { NameOf } from './groupBy.model';
import { CHANNELS_SCROLL_KEY } from '../../lib/scrollPos';
import type { RowMenu } from '../chatRow/chatRow';
import type { Row } from './model';

interface HomeState {
  rowMenu: RowMenu | null;
  setRowMenu: React.Dispatch<React.SetStateAction<RowMenu | null>>;
  pinned: readonly string[];
  scroll: PersistedScroll;
}

export function useHomeState(): HomeState {
  const [rowMenu, setRowMenu] = useState<RowMenu | null>(null);
  const pinned = usePinnedOrder();

  const scroll = usePersistedScroll(CHANNELS_SCROLL_KEY);

  return { rowMenu, setRowMenu, pinned, scroll };
}

interface GroupedRows {
  grouped: boolean;
  items: HomeListItem[];
  rows: Row[];
}

export function useGroupedRows(
  visibleRows: Row[],
  searchText: string,
  groupBy: HomeViewContent['groupBy'],
  nameOf: NameOf,
  namesVersion: number,
): GroupedRows {
  const { collapsed, order } = useChannelGroups();
  return useMemo(() => {
    if (groupBy === 'none') return { grouped: false, items: visibleRows, rows: visibleRows };
    const items = groupRows(visibleRows, groupBy, new Set(collapsed), searchText !== '', nameOf, order);
    return { grouped: true, items, rows: rowsOf(items) };
  }, [groupBy, collapsed, order, visibleRows, searchText, nameOf, namesVersion]);
}
