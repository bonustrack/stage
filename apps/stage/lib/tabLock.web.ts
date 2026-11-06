import { ACTIVE_TAB, createTabLock, type TabLock, type TabRole } from './tabLock.core';
import { capabilities } from './capabilities';
import { clientSlot } from './xmtp.state.web';
import { useStoreValue } from './storeCore';

const XMTP_TAB_LOCK = 'stage.xmtp';

let tabLock: TabLock | null = null;

function stepDown(): void {
  const client = clientSlot.get();
  if (client) clientSlot.discard(client);
  capabilities.reload();
}

function currentTabLock(): TabLock {
  if (tabLock) return tabLock;
  const locks: LockManager | undefined = typeof navigator === 'undefined' ? undefined : navigator.locks;
  tabLock = locks ? createTabLock(locks, XMTP_TAB_LOCK, stepDown) : ACTIVE_TAB;
  return tabLock;
}

export function useTabRole(): TabRole {
  const lock = currentTabLock();
  return useStoreValue(lock.subscribe, lock.role);
}

export function takeOverTab(): void {
  currentTabLock().takeOver();
}
