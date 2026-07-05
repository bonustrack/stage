
import {
  getCachedRows, subscribeCachedRows, hydrateCachedRows,
  getActiveAccountIdSync, type CachedRow,
} from '../../lib/channelsCache';
import { getQueryClient } from '../../lib/queryClient';
import { messagingKeys } from './queries';

function mirrorRows(rows: CachedRow[] | null): void {
  const key = messagingKeys.channels(getActiveAccountIdSync());
  getQueryClient().setQueryData<CachedRow[] | null>(key, rows);
}

let bridged = false;
export function ensureChannelsQueryBridge(): void {
  if (bridged) return;
  bridged = true;
  mirrorRows(getCachedRows());
  void hydrateCachedRows().then(mirrorRows);
  subscribeCachedRows(mirrorRows);
}
