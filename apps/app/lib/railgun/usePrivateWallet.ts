/** React hook bridging the Railgun cache/pending stores into a screen.
 *
 *  Returns an INSTANT first paint: the cached snapshot is read synchronously on
 *  mount (no spinner / no `loading` flash), pending optimistic deltas are
 *  overlaid live, and a background refresh swaps in fresh balances when ready.
 *
 *  BOOT-RACE GUARD: refreshSnapshot()→engineInit() boots the embedded Node
 *  (nodejs-mobile) runtime, whose native crypto/SQLCipher startup CONTENDS with
 *  XMTP's native `Client.create` MLS handshake when both run in the same process
 *  on first launch (intermittent "XMTP.create timed out" hangs). So the engine
 *  boot is ALWAYS gated behind `waitForXmtpReady()` — it only ever starts AFTER
 *  the XMTP client is ready, so nodejs-mobile is serialized after Client.create
 *  and never races it on boot:
 *    - `autoStart:true` consumers (both the always-mounted Tokens tab in
 *      WalletScreen.tsx AND the Private tab) await waitForXmtpReady() THEN boot
 *      the engine + background-refresh. The bridge's own `started`/readyPromise
 *      guard makes this single-flight, so whichever tab triggers it first wins
 *      and the other is a no-op (no double-start, one engine boot total).
 *    - `autoStart:false` (default) reads the warm cache only and never boots. */
import { useEffect, useState } from 'react';
import { getActiveAccountId } from '../accounts';
import { waitForXmtpReady } from '../xmtp';
import { snapshotStore, pendingStore, applyPending } from './cache';
import { openPrivateWallet } from './wallet';
import type { PrivateSnapshot, PendingAction } from './types';

export interface PrivateWalletState {
  accountId: string | null;
  snapshot: PrivateSnapshot | null;
  pending: PendingAction[];
}

/** @param autoStart  When true (Tokens tab + Private tab), boot the engine +
 *  background-refresh AFTER XMTP is ready (single-flight via the bridge guard).
 *  When false, read the warm cache only; do NOT boot nodejs-mobile. */
export function usePrivateWallet(autoStart = false): PrivateWalletState {
  const [accountId, setAccountId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<PrivateSnapshot | null>(null);
  const [pending, setPending] = useState<PendingAction[]>([]);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    let unsubP: (() => void) | undefined;
    let cancelled = false;
    void (async (): Promise<void> => {
      const id = await getActiveAccountId();
      if (!id || cancelled) return;
      setAccountId(id);
      // Synchronous warm read first, then hydrate + (optionally) refresh.
      setSnapshot(snapshotStore(id).get());
      unsub = snapshotStore(id).subscribe(setSnapshot);
      unsubP = pendingStore.subscribe(id, v => setPending(v ?? []));
      setPending(pendingStore.get(id) ?? []);
      if (!autoStart) {
        // Tokens-tab path: hydrate the disk cache for a fuller paint, but never
        // trigger the engine bridge boot (openPrivateWallet → refreshSnapshot).
        const warm = await snapshotStore(id).hydrate();
        if (warm && !cancelled) setSnapshot(warm);
        return;
      }
      // Private-tab path: serialize behind XMTP onboarding so the heavy
      // nodejs-mobile/engine boot never races Client.create on first launch.
      await waitForXmtpReady();
      if (cancelled) return;
      const warm = await openPrivateWallet(id);
      if (warm && !cancelled) setSnapshot(warm);
    })();
    return () => { cancelled = true; unsub?.(); unsubP?.(); };
  }, [autoStart]);

  // Overlay optimistic deltas onto the cached balances for the instant-feel UI.
  const merged = snapshot
    ? { ...snapshot, balances: applyPending(snapshot.balances, pending) }
    : null;

  return { accountId, snapshot: merged, pending };
}
