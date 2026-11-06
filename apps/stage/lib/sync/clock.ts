import { isNewerSyncState } from '@stage-labs/client/xmtp/sync/kind';
import { subscribeAccountEpoch } from '../accountEpoch';

const localAt = new Map<string, number>();

subscribeAccountEpoch(() => {
  localAt.clear();
});

export function stampLocal(key: string, at = Date.now()): number {
  localAt.set(key, at);
  return at;
}

export function takeIfNewer(key: string, at: number): boolean {
  if (!isNewerSyncState(localAt.get(key), at)) return false;
  localAt.set(key, at);
  return true;
}
