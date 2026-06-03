/** Railgun private-wallet cache + optimistic pending-action store.
 *
 *  This is the piece that makes the private balances tab feel INSTANT:
 *    - `snapshotStore` persists the last-known {zkAddress, balances} to disk
 *      (PersistentStore) so the tab paints immediately on open with no spinner;
 *      a background refresh then updates it.
 *    - `pendingStore` holds optimistic shield/send/unshield actions in memory so
 *      the UI reflects the delta the instant the user confirms — while the
 *      ~20-30s proof + broadcast runs in the background.
 *
 *  Built on the shared primitives in lib/cache.ts; no new disk plumbing. */
import { PersistentStore, MemoryStore } from '../cache';
import type { PrivateSnapshot, PendingAction, PrivateBalance } from './types';

/** Per-account snapshot file. Account-scoped so switching identities never
 *  shows another account's private balances (mirrors xmtp db-key scoping). */
const stores = new Map<string, PersistentStore<PrivateSnapshot>>();
export function snapshotStore(accountId: string): PersistentStore<PrivateSnapshot> {
  let s = stores.get(accountId);
  if (!s) { s = new PersistentStore<PrivateSnapshot>(`railgun-${accountId}.json`); stores.set(accountId, s); }
  return s;
}

/** In-memory optimistic actions, keyed by accountId. Never persisted — a
 *  pending proof doesn't survive a reload, and on reload the background refresh
 *  reflects whatever actually landed on-chain. */
export const pendingStore = new MemoryStore<string, PendingAction[]>();

export function addPending(accountId: string, action: PendingAction): void {
  pendingStore.set(accountId, [...(pendingStore.get(accountId) ?? []), action]);
}
export function updatePending(accountId: string, id: string, patch: Partial<PendingAction>): void {
  pendingStore.set(accountId, (pendingStore.get(accountId) ?? []).map(a => a.id === id ? { ...a, ...patch } : a));
}
/** Phases that are still in flight (kept in the store + drive optimistic UI). */
export function isLivePending(p: PendingAction): boolean {
  return p.phase === 'proving' || p.phase === 'broadcasting' || p.phase === 'scanning';
}

export function clearSettledPending(accountId: string): void {
  pendingStore.set(accountId, (pendingStore.get(accountId) ?? []).filter(isLivePending));
}

/** Drop a single pending action (e.g. once its shielded balance has landed). */
export function removePending(accountId: string, id: string): void {
  pendingStore.set(accountId, (pendingStore.get(accountId) ?? []).filter(a => a.id !== id));
}

/** Overlay in-flight optimistic deltas onto the cached balances so the rendered
 *  rows reflect pending shields/sends before they confirm. Pure — does not
 *  mutate the cache; the real numbers replace these on the next refresh. */
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
