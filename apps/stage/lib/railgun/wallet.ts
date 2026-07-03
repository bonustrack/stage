import { isRailgunAvailable } from './native';
import { isBridgeAvailable } from './bridge';
import { bridgeRefreshSnapshot } from './bridgeWallet';
import { ensureRailgunForChain } from './engine';
import { deriveRailgunWallet } from './sdkWallet';
import { snapshotStore } from './cache';
import type { PrivateSnapshot } from './types';

function getCachedSnapshot(accountId: string): PrivateSnapshot | null {
  return snapshotStore(accountId).get();
}

export async function openPrivateWallet(accountId: string): Promise<PrivateSnapshot | null> {
  const warm = await snapshotStore(accountId).hydrate();
  void refreshSnapshot(accountId);
  return warm;
}

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
  } catch { }
}

