/** @file Account-switch signal: a bumped epoch lets screens holding per-account state re-init their XMTP usage when the active account changes, avoiding a full app reload. */

import { useSyncExternalStore } from 'react';

let epoch = 0;
const listeners = new Set<() => void>();

/** Bump the account epoch, notifying all subscribers that the active account changed. */
export function bumpAccountEpoch(): void {
  epoch += 1;
  for (const l of listeners) l();
}

/** Non-hook read of the current account epoch — for react-query keys that need to scope a cached resolution to the active account (so an in-place account switch invalidates the entry without a hook). */
export function getAccountEpoch(): number { return epoch; }

/** Re-renders the caller whenever the active account changes. Use the returned value as a useEffect dependency to re-run per-account initialisation. */
export function useAccountEpoch(): number {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    () => epoch,
  );
}
