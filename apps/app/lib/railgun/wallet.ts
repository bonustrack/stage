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
import { parseUnits } from 'viem';
import { isRailgunAvailable } from './native';
import { isBridgeAvailable } from '@metro-labs/railgun-mobile/bridge';
import { bridgeRefreshSnapshot } from './bridgeWallet';
import { ensureRailgunForChain } from './engine';
import { deriveRailgunWallet } from './sdkWallet';
import { shield, privateTransfer, unshield } from './sdkTx';
import { netForChainId } from './networks';
import { snapshotStore, addPending, updatePending, clearSettledPending } from './cache';
import type { PrivateSnapshot, PendingAction } from './types';

/** Synchronous warm read for instant render. */
export function getCachedSnapshot(accountId: string): PrivateSnapshot | null {
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

/** Fire an optimistic shield/send/unshield. Returns the pending-action id. The
 *  heavy proof + broadcast run in the background; the UI already shows the
 *  pending delta. `req.token` is the ERC20 contract address; `req.delta` the
 *  (18-dp) decimal amount. */
export function runAction(
  accountId: string,
  req: { kind: PendingAction['kind']; symbol: string; chainId: number; delta: string; recipient?: string; token?: string },
): string {
  const id = `${req.kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  addPending(accountId, { id, phase: 'proving', startedAt: Date.now(), ...req });
  void (async (): Promise<void> => {
    if (!isRailgunAvailable()) {
      updatePending(accountId, id, { phase: 'failed', error: 'Private wallet needs the new app build' });
      return;
    }
    try {
      if (!(await ensureRailgunForChain(req.chainId))) throw new Error('Railgun engine unavailable');
      const wallet = await deriveRailgunWallet();
      const net = netForChainId(req.chainId).net;
      const token = { tokenAddress: (req.token ?? '').trim(), amount: parseUnits(req.delta.replace('-', '') as `${number}`, 18) };
      if (!token.tokenAddress) throw new Error('Token address required');
      updatePending(accountId, id, { phase: 'broadcasting' });
      if (req.kind === 'shield') await shield(net, token, wallet.railgunAddress);
      else if (req.kind === 'send') await privateTransfer(net, wallet, token, (req.recipient ?? '').trim());
      else await unshield(net, wallet, token, (req.recipient ?? '').trim());
      updatePending(accountId, id, { phase: 'confirmed' });
      await refreshSnapshot(accountId);
      clearSettledPending(accountId);
    } catch (e) {
      updatePending(accountId, id, { phase: 'failed', error: (e as Error).message });
    }
  })();
  return id;
}
