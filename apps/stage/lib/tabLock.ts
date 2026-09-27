import { ACTIVE_TAB, type TabRole } from './tabLock.core';

export function useTabRole(): TabRole {
  return ACTIVE_TAB.role();
}

export function takeOverTab(): void {
  ACTIVE_TAB.takeOver();
}
