import { useMemo } from 'react';
import type { GroupKey } from '@stage-labs/client/xmtp/sync/homeView';
import { setBoardOrder, useBoardOrder } from './boardOrder';
import { setCategoryOrder, useChannelGroups } from './channelGroups';
import { groupingOrderStore, type GroupingOrders } from './grouping.model';

export function useGroupingOrders(): GroupingOrders {
  const board = useBoardOrder();
  const categories = useChannelGroups().order;
  return useMemo(() => ({ categories, board }), [categories, board]);
}

export function saveGroupingOrder(by: GroupKey, order: readonly string[]): void {
  if (groupingOrderStore(by) === 'categories') setCategoryOrder(order);
  else setBoardOrder(order);
}
