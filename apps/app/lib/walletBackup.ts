/** Device-local "has the user backed up / dismissed the recovery-phrase nudge".
 *
 *  Onboarding defers showing the recovery phrase; the SecureWalletNudge (Settings
 *  -> Security) is where the user backs it up later. This single persisted
 *  boolean records that they either confirmed the backup OR dismissed the nudge,
 *  so it stops pestering them. Default FALSE so a fresh smart wallet sees the
 *  nudge once. Built on the shared createValueStore factory. */

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
