import type { GroupKey } from '@stage-labs/client/xmtp/sync/homeView';
import { setBoardOrder } from './boardOrder';
import { setCategoryOrder } from './channelGroups';
import { groupingOrderStore } from './grouping.model';

export function saveGroupingOrder(by: GroupKey, order: readonly string[]): void {
  if (groupingOrderStore(by) === 'categories') setCategoryOrder(order);
  else setBoardOrder(order);
}
