/** @file Device-local persisted boolean recording whether the user backed up (or dismissed the nudge for) their recovery phrase so SecureWalletNudge stops pestering them; built on the shared createValueStore factory and defaults FALSE so a fresh smart wallet sees the nudge once. */

import { createValueStore } from './persistedStore';

const store = createValueStore<boolean>({
  key: 'wallet.backupDone',
  default: false,
  serialize: (v) => (v ? '1' : '0'),
  deserialize: (raw) => raw === '1' || raw === 'true',
});

/** Read whether backup was confirmed or the nudge dismissed (awaits the load). */
export const isWalletBackedUp = (): Promise<boolean> => store.load();

/** Persist that the wallet was backed up (or the nudge dismissed). */
export const setWalletBackedUp = (v: boolean): Promise<void> => store.setAsync(v);
