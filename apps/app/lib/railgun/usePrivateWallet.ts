/** React hook bridging the Railgun cache/pending stores into a screen.
 *
 *  Returns an INSTANT first paint: the cached snapshot is read synchronously on
 *  mount (no spinner / no `loading` flash), pending optimistic deltas are
 *  overlaid live, and a background refresh swaps in fresh balances when ready. */
import { useEffect, useState } from 'react';
import { getActiveAccountId } from '../accounts';
import { snapshotStore, pendingStore, applyPending } from './cache';
import { openPrivateWallet } from './wallet';
import type { PrivateSnapshot, PendingAction } from './types';

export interface PrivateWalletState {
  accountId: string | null;
  snapshot: PrivateSnapshot | null;
  pending: PendingAction[];
}

export function usePrivateWallet(): PrivateWalletState {
  const [accountId, setAccountId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<PrivateSnapshot | null>(null);
  const [pending, setPending] = useState<PendingAction[]>([]);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    let unsubP: (() => void) | undefined;
    void (async (): Promise<void> => {
      const id = await getActiveAccountId();
      if (!id) return;
      setAccountId(id);
      // Synchronous warm read first, then hydrate + background refresh.
      setSnapshot(snapshotStore(id).get());
      unsub = snapshotStore(id).subscribe(setSnapshot);
      unsubP = pendingStore.subscribe(id, v => setPending(v ?? []));
      setPending(pendingStore.get(id) ?? []);
      const warm = await openPrivateWallet(id);
      if (warm) setSnapshot(warm);
    })();
    return () => { unsub?.(); unsubP?.(); };
  }, []);

  // Overlay optimistic deltas onto the cached balances for the instant-feel UI.
  const merged = snapshot
    ? { ...snapshot, balances: applyPending(snapshot.balances, pending) }
    : null;

  return { accountId, snapshot: merged, pending };
}
