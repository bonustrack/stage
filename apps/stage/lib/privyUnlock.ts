import type { Hex } from 'viem';
import { isUnlockSignature } from '@stage-labs/client/accounts/privy';
import { secureStorage } from '../platform/storage';
import type { DeviceBoundAccessOptions } from '../platform/types';
import { ignored } from './errorPolicy';
import { memoized } from './storeCore';

const STORE_OPTS: DeviceBoundAccessOptions = { thisDeviceOnly: true };

const unlocks = new Map<string, Promise<Hex>>();

function unlockKey(accountId: string): string {
  return `privy.unlock.${accountId}`;
}

export function privyUnlockSignature(accountId: string, sign: () => Promise<Hex>): Promise<Hex> {
  return memoized(unlocks, accountId, async () => {
    const stored = await secureStorage.get(unlockKey(accountId), STORE_OPTS);
    if (isUnlockSignature(stored)) return stored;
    const signature = await sign();
    if (!isUnlockSignature(signature)) throw new Error('The wallet returned a signature Stage cannot use.');
    await secureStorage.set(unlockKey(accountId), signature, STORE_OPTS);
    return signature;
  });
}

export async function forgetPrivyUnlock(accountId: string): Promise<void> {
  unlocks.delete(accountId);
  await secureStorage.delete(unlockKey(accountId)).catch(ignored(undefined, 'cleanup'));
}
