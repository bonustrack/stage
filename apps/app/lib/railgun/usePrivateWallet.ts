/** @file React hook bridging the Railgun cache/pending stores into a screen with instant first paint; engine boot is gated behind `waitForXmtpReady()` so native crypto never races XMTP's `Client.create` on first launch. */
import { useEffect, useState } from 'react';
import { getActiveAccountId } from '../accounts';
import { useAccountEpoch } from '../accountEpoch';
import { waitForXmtpReady } from '../xmtp';
import { snapshotStore, pendingStore, applyPending } from './cache';
import { openPrivateWallet } from './wallet';
import { startBalanceWatch } from './balanceWatch';
import type { PrivateSnapshot, PendingAction } from './types';

export interface PrivateWalletState {
  accountId: string | null;
  snapshot: PrivateSnapshot | null;
  pending: PendingAction[];
}

/** Bridges Railgun stores into state; when `autoStart` is true boots the engine and refreshes after XMTP is ready, otherwise reads only the warm cache. */
export function usePrivateWallet(autoStart = false): PrivateWalletState {
  const [accountId, setAccountId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<PrivateSnapshot | null>(null);
  const [pending, setPending] = useState<PendingAction[]>([]);

  /** Re-run the per-account init when the active account changes (switchToAccount bumps this epoch). Without it the hook captures the boot account's id once and the shielded snapshot/pending stay stale after a switch. */
  const accountEpoch = useAccountEpoch();

  useEffect(() => {
    let unsub: (() => void) | undefined;
    let unsubP: (() => void) | undefined;
    let stopWatch: (() => void) | undefined;
    let cancelled = false;
    void (async (): Promise<void> => {
      const id = await getActiveAccountId();
      if (!id || cancelled) return;
      setAccountId(id);
      /** Synchronous warm read straight from this account's store so a switch repaints to its rows (or null) immediately instead of leaving the previous account's snapshot. */
      setSnapshot(snapshotStore(id).get());
      unsub = snapshotStore(id).subscribe(setSnapshot);
      unsubP = pendingStore.subscribe(id, v => { setPending(v ?? []); });
      setPending(pendingStore.get(id) ?? []);
      if (!autoStart) {
        /** Tokens-tab path: hydrate the disk cache for a fuller paint, but never trigger the engine bridge boot. */
        const warm = await snapshotStore(id).hydrate();
        if (warm && !cancelled) setSnapshot(warm);
        return;
      }
      /** Private-tab path: serialize behind XMTP onboarding so the heavy engine boot never races Client.create, and fold late-arriving balanceUpdate events into the store so a post-scan balance repaints the tab. */
      stopWatch = startBalanceWatch(id);
      await waitForXmtpReady();
      if (cancelled) return;
      const warm = await openPrivateWallet(id);
      if (warm && !cancelled) setSnapshot(warm);
    })();
    return () => { cancelled = true; unsub?.(); unsubP?.(); stopWatch?.(); };
  }, [autoStart, accountEpoch]);

  /** Overlay optimistic deltas onto the cached balances for the instant-feel UI. */
  const merged = snapshot
    ? { ...snapshot, balances: applyPending(snapshot.balances, pending) }
    : null;

  return { accountId, snapshot: merged, pending };
}
