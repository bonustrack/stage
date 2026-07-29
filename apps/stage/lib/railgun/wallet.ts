import '../cryptoShim';
import { getActiveAccount } from '../accounts';
import { requireWalletApi } from './sdkApi';
import { deriveRailgunKeyMaterial } from './deriveKeys';
import { isRailgunAvailable } from './native';
import { isBridgeAvailable } from './bridge';
import { bridgeRefreshSnapshot } from './bridgeWallet';
import { ensureRailgunForChain } from './engine';
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

export interface RailgunWalletHandle {
  id: string;
  railgunAddress: string;
  encryptionKey: string;
}

let cached: RailgunWalletHandle | null = null;
let cachedForId: string | null = null;

export async function deriveRailgunWallet(): Promise<RailgunWalletHandle> {
  const acct = await getActiveAccount();
  if (!acct) throw new Error('No active account');
  if (cached && cachedForId === acct.id) return cached;

  const { mnemonic, encryptionKey, creationBlocks } = await deriveRailgunKeyMaterial();

  const sdk = requireWalletApi();
  const info = await sdk.createRailgunWallet(encryptionKey, mnemonic, creationBlocks);
  const addr: unknown = sdk.getRailgunAddress(info.id);
  const railgunAddress = typeof addr === 'string' ? addr : '';
  cached = { id: info.id, railgunAddress, encryptionKey };
  cachedForId = acct.id;
  return cached;
}
