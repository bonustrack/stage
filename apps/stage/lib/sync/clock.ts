import { isNewerSyncState } from '@stage-labs/client/xmtp/sync/kind';
import { subscribeAccountEpoch } from '../accountEpoch';
import { nextStamp } from '../syncedSettings.model';

const localAt = new Map<string, number>();

subscribeAccountEpoch(() => {
  localAt.clear();
});

export function stampLocal(key: string, at = nextStamp(localAt.get(key), Date.now())): number {
  localAt.set(key, at);
  return at;
}

export function takeIfNewer(key: string, at: number): boolean {
  if (!isNewerSyncState(localAt.get(key), at)) return false;
  localAt.set(key, at);
  return true;
}
