/** Global shielded-balance-update watcher (the RN-side fix for "balance shows 0
 *  after shield").
 *
 *  THE BUG: engine.js's `balances` handler fires `refreshBalances` fire-and-
 *  forget and returns IMMEDIATELY with whatever's already cached — empty on a
 *  cold wallet. The real rows arrive ~seconds later via `event:balanceUpdate`.
 *  bridgeRefreshSnapshot only did a single one-shot getBalances(), so that late
 *  event was dropped on the floor and the snapshot stayed at 0. (shieldScan only
 *  listens after an IN-APP shield; a balance shielded by any other path, or a
 *  plain tab-open, had no listener.)
 *
 *  THE FIX: subscribe ONCE to `event:balanceUpdate` for the active account and
 *  fold each payload's rows straight into the snapshot store, so a balance that
 *  lands after the initial scan repaints the tab without any user action. Also
 *  mirrors every event into balanceDebug for the on-screen diagnostics. */
import { bridgeListen } from '@metro-labs/railgun-mobile/bridge';
import { snapshotStore } from './cache';
import { mapEventRows } from './bridgeWallet';
import { recordBalanceEvent } from './balanceDebug';
import type { BridgeBalanceRow } from '@metro-labs/railgun-mobile/bridge';

interface BalanceUpdatePayload {
  chainId?: number;
  walletId?: string;
  rows?: BridgeBalanceRow[];
}

const watched = new Set<string>();

/** Start the live balanceUpdate→snapshot fold for an account (idempotent). */
export function startBalanceWatch(accountId: string): () => void {
  if (watched.has(accountId)) return () => undefined;
  watched.add(accountId);
  const unsub = bridgeListen('event:balanceUpdate', (payload: unknown) => {
    recordBalanceEvent(payload);
    const p = (payload ?? {}) as BalanceUpdatePayload;
    if (typeof p.chainId !== 'number' || !Array.isArray(p.rows)) return;
    const fresh = mapEventRows(p.chainId, p.rows);
    if (!fresh.length) return;
    const prev = snapshotStore(accountId).get();
    if (!prev) return;
    // Replace this chain's rows with the fresh ones; keep other chains intact.
    const others = prev.balances.filter((b) => b.chainId !== p.chainId);
    snapshotStore(accountId).set({
      ...prev,
      balances: [...others, ...fresh],
      updatedAt: Date.now(),
      scanning: false,
    });
  });
  return () => {
    watched.delete(accountId);
    unsub();
  };
}
