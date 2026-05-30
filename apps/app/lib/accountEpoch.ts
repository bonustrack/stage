/** Account-switch signal.
 *
 *  Switching accounts used to call DevSettings.reload() — a full app reload that,
 *  on the dev client, re-downloads the whole JS bundle (the bulk of the 5-10s
 *  switch delay) and flashes white. Instead we switch the XMTP client in place
 *  (see switchToAccount) and bump this epoch; screens that hold per-account state
 *  (the channels list) re-init their XMTP usage when the epoch changes.
 *
 *  The old client object is only dereferenced (not destroyed), so any still-mounted
 *  screen keeps working until it re-renders — no crash, just stale until renavigate. */

import { useSyncExternalStore } from 'react';

let epoch = 0;
const listeners = new Set<() => void>();

export function bumpAccountEpoch(): void {
  epoch += 1;
  for (const l of listeners) l();
}

/** Non-hook read of the current account epoch — for react-query keys that need
 *  to scope a cached resolution to the active account (so an in-place account
 *  switch invalidates the entry without a hook). */
export function getAccountEpoch(): number { return epoch; }

/** Re-renders the caller whenever the active account changes. Use the returned
 *  value as a useEffect dependency to re-run per-account initialisation. */
export function useAccountEpoch(): number {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    () => epoch,
  );
}
