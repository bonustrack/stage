/** @file Railgun private-wallet API the UI calls, with an instant-feel contract (synchronous cached snapshot, background refresh, optimistic runAction); engine/wallet/tx work is delegated to SDK modules that resolve to safe empty/unavailable states when the native prover isn't in this build. */
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

/** Background refresh (never throws): resolve and persist the real 0zk address + shielded balances; preferred path is the embedded Node host (the only place the engine inits), falling back to the Hermes direct-SDK path that derives the address only and preserves cached balances. */
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
  } catch { /** keep the warm cache */ }
}

