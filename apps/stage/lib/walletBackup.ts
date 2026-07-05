
import { createValueStore } from './persistedStore';

const store = createValueStore<boolean>({
  key: 'wallet.backupDone',
  default: false,
  serialize: (v) => (v ? '1' : '0'),
  deserialize: (raw) => raw === '1' || raw === 'true',
});

export const isWalletBackedUp = (): Promise<boolean> => store.load();

export const setWalletBackedUp = (v: boolean): Promise<void> => store.setAsync(v);
