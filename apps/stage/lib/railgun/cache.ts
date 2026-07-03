import { PersistentStore, MemoryStore } from '../cache';
import type { PrivateSnapshot, PendingAction, PrivateBalance } from './types';

const stores = new Map<string, PersistentStore<PrivateSnapshot>>();
export function snapshotStore(accountId: string): PersistentStore<PrivateSnapshot> {
  let s = stores.get(accountId);
  if (!s) { s = new PersistentStore<PrivateSnapshot>(`railgun-${accountId}.json`); stores.set(accountId, s); }
  return s;
}

export const pendingStore = new MemoryStore<string, PendingAction[]>();

export function addPending(accountId: string, action: PendingAction): void {
  pendingStore.set(accountId, [...(pendingStore.get(accountId) ?? []), action]);
}
export function updatePending(accountId: string, id: string, patch: Partial<PendingAction>): void {
  pendingStore.set(accountId, (pendingStore.get(accountId) ?? []).map(a => a.id === id ? { ...a, ...patch } : a));
}
function isLivePending(p: PendingAction): boolean {
  return p.phase === 'proving' || p.phase === 'broadcasting' || p.phase === 'scanning';
}

export function removePending(accountId: string, id: string): void {
  pendingStore.set(accountId, (pendingStore.get(accountId) ?? []).filter(a => a.id !== id));
}

export function applyPending(balances: PrivateBalance[], pending: PendingAction[]): PrivateBalance[] {
  const live = pending.filter(isLivePending);
  if (!live.length) return balances;
  return balances.map(b => {
    const delta = live
      .filter(p => p.symbol === b.symbol && p.chainId === b.chainId)
      .reduce((sum, p) => sum + Number(p.delta), 0);
    if (!delta) return b;
    const next = Math.max(0, Number(b.balance) + delta);
    return { ...b, balance: String(next) };
  });
}
