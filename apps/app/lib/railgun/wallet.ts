/** Railgun private-wallet API — the surface the UI calls.
 *
 *  INSTANT-feel contract:
 *    - getCachedSnapshot(): synchronous, returns the warm disk copy so the tab
 *      paints with zero spinner on open.
 *    - refreshSnapshot(): background refresh; updates the cache + notifies
 *      subscribers when fresh balances land. Degrades to the cache on failure.
 *    - runAction(): optimistic — records the pending delta IMMEDIATELY (UI
 *      reflects it at once), then proves + broadcasts in the background, moving
 *      the pending action through proving → broadcasting → confirmed/failed.
 *
 *  All real engine work is delegated to the guarded engine wrapper; when the
 *  native module isn't linked these resolve to safe empty/unavailable states. */
import { loadRailgunEngine } from './native';
import { isRailgunReady, prewarmRailgun } from './engine';
import {
  snapshotStore, addPending, updatePending, clearSettledPending,
} from './cache';
import type { PrivateSnapshot, PendingAction } from './types';

/** Synchronous warm read for instant render. Caller should `hydrate()` the
 *  store once on mount (cheap, idempotent) before relying on this. */
export function getCachedSnapshot(accountId: string): PrivateSnapshot | null {
  return snapshotStore(accountId).get();
}

/** Hydrate the disk cache, kick a background refresh, and ensure the engine is
 *  pre-warming. Returns the warm snapshot synchronously-available copy. */
export async function openPrivateWallet(accountId: string): Promise<PrivateSnapshot | null> {
  const warm = await snapshotStore(accountId).hydrate();
  void prewarmRailgun();        // eager, fire-and-forget
  void refreshSnapshot(accountId); // background, non-blocking
  return warm;
}

/** Background balance refresh. Pulls fresh private balances from the engine and
 *  writes them through to the disk cache (which notifies subscribers). Silently
 *  keeps the existing cache on any failure — never throws. */
export async function refreshSnapshot(accountId: string): Promise<void> {
  const eng = loadRailgunEngine() as RailgunWalletApi | null;
  if (!eng) return;
  try {
    if (!isRailgunReady()) await prewarmRailgun();
    const zkAddress = (await eng.getZkAddress?.(accountId)) ?? getCachedSnapshot(accountId)?.zkAddress;
    if (!zkAddress) return;
    const balances = (await eng.getPrivateBalances?.(accountId)) ?? [];
    snapshotStore(accountId).set({ zkAddress, balances, updatedAt: Date.now() });
  } catch { /* keep the warm cache */ }
}

/** Fire an optimistic shield/send/unshield. Returns the pending-action id so the
 *  screen can subscribe to its progress. The heavy proof + broadcast run in the
 *  background; the caller's UI already shows the pending delta. */
export function runAction(
  accountId: string,
  req: { kind: PendingAction['kind']; symbol: string; chainId: number; delta: string; recipient?: string },
): string {
  const id = `${req.kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  addPending(accountId, { id, phase: 'proving', startedAt: Date.now(), ...req });
  void (async (): Promise<void> => {
    const eng = loadRailgunEngine() as RailgunWalletApi | null;
    if (!eng?.submitAction) {
      updatePending(accountId, id, { phase: 'failed', error: 'Private transactions not available on this build' });
      return;
    }
    try {
      if (!isRailgunReady()) await prewarmRailgun();
      const { txHash } = await eng.submitAction(accountId, req, p => updatePending(accountId, id, { phase: p }));
      updatePending(accountId, id, { phase: 'confirmed', txHash });
      await refreshSnapshot(accountId);
      clearSettledPending(accountId);
    } catch (e) {
      updatePending(accountId, id, { phase: 'failed', error: (e as Error).message });
    }
  })();
  return id;
}

/** Structural view of the engine's wallet surface used here; methods optional so
 *  a missing/older SDK degrades gracefully rather than throwing. */
interface RailgunWalletApi {
  getZkAddress?: (accountId: string) => Promise<string>;
  getPrivateBalances?: (accountId: string) => Promise<PrivateSnapshot['balances']>;
  submitAction?: (
    accountId: string,
    req: { kind: string; symbol: string; chainId: number; delta: string; recipient?: string },
    onPhase: (p: PendingAction['phase']) => void,
  ) => Promise<{ txHash: string }>;
}
