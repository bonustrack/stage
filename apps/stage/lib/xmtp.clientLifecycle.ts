import { getActiveAccount, getSelectedAccount, loadAccounts, markRegistered, removeAccount, setActiveAccountId } from './accounts';
import { bumpAccountEpoch } from './accountEpoch';
import { makeClientLifecycle, type ClientSdk } from './xmtp.client.core';
import { makeClientFinalizer } from './xmtp.recover.core';
import type { ClientSlot } from './xmtp.state.core';
import { wipeXmtpStore } from './xmtp.dbkey';
import { deleteDbFiles } from './xmtp.dbkeyFs';
import { registerCachedClientPush } from './pushRegister';

export function appClientLifecycle<C>(sdk: ClientSdk<C>, slot: ClientSlot<C>): ReturnType<typeof makeClientLifecycle<C>> {
  const finalize = makeClientFinalizer<C>({ active: getSelectedAccount, markRegistered, discard: slot.discard });
  return makeClientLifecycle<C>({
    accounts: { active: getActiveAccount, list: loadAccounts, setActive: setActiveAccountId, remove: removeAccount },
    store: { deleteFiles: deleteDbFiles, deleteKey: sdk.forgetStore, wipe: wipeXmtpStore, forgetSaved: sdk.forgetSaved },
    client: {
      get: slot.get,
      getOrCreate: slot.getOrCreate,
      build: (rec) => sdk.build(rec, finalize),
      ready: registerCachedClientPush,
      dispose: slot.reset,
      selfAddressOf: sdk.selfAddressOf,
      syncPreferences: sdk.syncPreferences,
      installations: sdk.installations,
      installationIdOf: sdk.installationIdOf,
      revoke: sdk.revoke,
    },
    bumpEpoch: bumpAccountEpoch,
  });
}
