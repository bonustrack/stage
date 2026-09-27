import { useSyncExternalStore } from 'react';
import { ACTIVE_TAB, createTabLock, type TabLock, type TabRole } from './tabLock.core';
import { reloadApp } from './reloadApp';

const XMTP_TAB_LOCK = 'stage.xmtp';

let tabLock: TabLock | null = null;

function currentTabLock(): TabLock {
  if (tabLock) return tabLock;
  const locks: LockManager | undefined = typeof navigator === 'undefined' ? undefined : navigator.locks;
  tabLock = locks ? createTabLock(locks, XMTP_TAB_LOCK, () => { reloadApp(); }) : ACTIVE_TAB;
  return tabLock;
}

export function useTabRole(): TabRole {
  const lock = currentTabLock();
  return useSyncExternalStore(lock.subscribe, lock.role, lock.role);
}

export function takeOverTab(): void {
  currentTabLock().takeOver();
}
