import { useEffect } from 'react';
import { createValueStore, flagCodec } from './persistedStore';
import { makeValue } from './storeCore';
import { reported } from './errorPolicy';

const backedUp = createValueStore<boolean>({ key: 'wallet.backupDone', default: false, ...flagCodec(false) });

const loaded = makeValue(false);

function loadBackedUp(): void {
  if (loaded.get()) return;
  void backedUp.load().then(() => {
    loaded.set(true);
  }, reported('wallet.backupDone'));
}

export function useWalletBackedUp(): boolean | null {
  useEffect(loadBackedUp, []);
  const value = backedUp.use();
  return loaded.use() ? value : null;
}

export async function markWalletBackedUp(): Promise<void> {
  await backedUp.setAsync(true);
  loaded.set(true);
}
