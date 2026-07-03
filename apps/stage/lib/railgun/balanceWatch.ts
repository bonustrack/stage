
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
