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

export function usePrivateWallet(autoStart = false): PrivateWalletState {
  const [accountId, setAccountId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<PrivateSnapshot | null>(null);
  const [pending, setPending] = useState<PendingAction[]>([]);

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
      setSnapshot(snapshotStore(id).get());
      unsub = snapshotStore(id).subscribe(setSnapshot);
      unsubP = pendingStore.subscribe(id, v => { setPending(v ?? []); });
      setPending(pendingStore.get(id) ?? []);
      if (!autoStart) {
        const warm = await snapshotStore(id).hydrate();
        if (warm && !cancelled) setSnapshot(warm);
        return;
      }
      stopWatch = startBalanceWatch(id);
      await waitForXmtpReady();
      if (cancelled) return;
      const warm = await openPrivateWallet(id);
      if (warm && !cancelled) setSnapshot(warm);
    })();
    return () => { cancelled = true; unsub?.(); unsubP?.(); stopWatch?.(); };
  }, [autoStart, accountEpoch]);

  const merged = snapshot
    ? { ...snapshot, balances: applyPending(snapshot.balances, pending) }
    : null;

  return { accountId, snapshot: merged, pending };
}
