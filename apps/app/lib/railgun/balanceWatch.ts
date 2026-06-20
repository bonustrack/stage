/** @file Global watcher that subscribes once to the engine's `event:balanceUpdate` and folds late-arriving shielded-balance rows into the snapshot store so the Private tab repaints without user action. */

/** Global shielded-balance-update watcher: engine.js returns cached (empty) balances immediately while real rows arrive later via `event:balanceUpdate`, so this subscribes once per active account and folds each payload into the snapshot store (also mirrored to balanceDebug) to repaint without user action. */
import { bridgeListen } from './bridge';
import { snapshotStore } from './cache';
import { mapEventRows } from './bridgeWallet';
import { recordBalanceEvent } from './balanceDebug';
import type { BridgeBalanceRow } from './bridge';

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
    /** Replace this chain's rows with the fresh ones; keep other chains intact. */
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
