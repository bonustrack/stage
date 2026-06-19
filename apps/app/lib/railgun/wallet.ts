/** Railgun private-wallet API — the surface the UI calls.
 *
 *  INSTANT-feel contract (unchanged):
 *    - getCachedSnapshot(): synchronous warm disk copy → zero-spinner open.
 *    - refreshSnapshot(): background refresh; derives the REAL 0zk address from
 *      the active account + pulls shielded balances, writing through the cache.
 *    - runAction(): optimistic — records the pending delta IMMEDIATELY, then
 *      proves + broadcasts in the background via the real SDK, moving the action
 *      through proving → broadcasting → confirmed/failed.
 *
 *  Real engine/wallet/tx work is delegated to the SDK modules (sdkEngine /
 *  sdkWallet / sdkTx); when the native prover isn't in this build these resolve
 *  to safe empty/unavailable states (see native.ts). */
import { isRailgunAvailable } from './native';
import { isBridgeAvailable } from './bridge';
import { bridgeRefreshSnapshot } from './bridgeWallet';
import { ensureRailgunForChain } from './engine';
import { deriveRailgunWallet } from './sdkWallet';
import { snapshotStore } from './cache';
import type { PrivateSnapshot } from './types';

/** Synchronous warm read for instant render. */
function getCachedSnapshot(accountId: string): PrivateSnapshot | null {
  return snapshotStore(accountId).get();
}

/** Hydrate the disk cache, kick a background refresh + engine pre-warm. */
export async function openPrivateWallet(accountId: string): Promise<PrivateSnapshot | null> {
  const warm = await snapshotStore(accountId).hydrate();
  void refreshSnapshot(accountId);
  return warm;
}

/** Background refresh: resolve the real 0zk address + shielded balances and
 *  persist them so the tab shows the user's actual private wallet. Never throws.
 *
 *  PREFERRED PATH (device): the embedded Node host — the RAILGUN engine only
 *  inits there, so it's the source of truth for both the 0zk address and the
 *  shielded balances (bridgeRefreshSnapshot). FALLBACK: the Hermes direct-SDK
 *  path, which can derive the 0zk address but can't init the engine on-device,
 *  so it's address-only and preserves any cached balances. */
export async function refreshSnapshot(accountId: string): Promise<void> {
  const prev = getCachedSnapshot(accountId);
  try {
    if (isBridgeAvailable()) {
      const next = await bridgeRefreshSnapshot(prev);
      if (next) { snapshotStore(accountId).set(next); return; }
    }
    if (!isRailgunAvailable()) return;
    if (!(await ensureRailgunForChain(1))) return;
    const wallet = await deriveRailgunWallet();
    snapshotStore(accountId).set({
      zkAddress: wallet.railgunAddress,
      balances: prev?.balances ?? [],
      updatedAt: Date.now(),
    });
  } catch { /* keep the warm cache */ }
}

