import { Client, PublicIdentity } from '@xmtp/react-native-sdk';
import {
  getActiveAccount, loadAccounts, setActiveAccountId, removeAccount, type AccountRecord,
} from './accounts';
import { bumpAccountEpoch } from './accountEpoch';
import { XMTP_CODECS, signerForRecord } from './xmtp.codecs';
import { getCachedXmtpClient, resetClientScopedState, getOrCreateCachedClient } from './xmtp.state';
import { whileRegistering } from './xmtp.state.core';
import type { XmtpEnv } from './xmtp.types';
import { loadOrCreateDbKey, deleteDbKey, deleteDbFiles, ensureDbDir, wipeXmtpStore } from './xmtp.dbkey';
import { createClientForAccount, finalizeClient, isStoreCorruption } from './xmtp.recover';
import { makeClientLifecycle } from './xmtp.client.core';
import { forgetPushAccount, recordPushAccount } from './xmtp.appGroup';

type InstallationId = Parameters<Client['revokeInstallations']>[1][number];

const REGISTERED_BUILD_TIMEOUT_MS = 20_000;

async function openClientForAccount(rec: AccountRecord, env: XmtpEnv): Promise<Client> {
  const dbDirectory = await ensureDbDir(rec.dbDir);
  const dbEncryptionKey = await loadOrCreateDbKey(rec.id);
  let opts = { env, dbDirectory, dbEncryptionKey, codecs: XMTP_CODECS };
  if (rec.registered) {
    try {
      const built = await Promise.race<Client | null>([
        Client.build(new PublicIdentity(rec.address, 'ETHEREUM'), opts),
        new Promise<null>((resolve) => setTimeout(() => { resolve(null); }, REGISTERED_BUILD_TIMEOUT_MS)),
      ]);
      if (built) return await finalizeClient(built, rec, env, { markRegistered: false });
    } catch (e) {
      if (isStoreCorruption(e)) {
        await wipeXmtpStore(rec.id, rec.dbDir);
        const dir = await ensureDbDir(rec.dbDir);
        const key = await loadOrCreateDbKey(rec.id);
        opts = { env, dbDirectory: dir, dbEncryptionKey: key, codecs: XMTP_CODECS };
      }
    }
  }
  return whileRegistering(() => createClientForAccount(rec, env, opts));
}

async function buildClientForAccount(rec: AccountRecord, env: XmtpEnv): Promise<Client> {
  const client = await openClientForAccount(rec, env);
  recordPushAccount({ id: rec.id, address: rec.address, inboxId: client.inboxId, dbDir: rec.dbDir, env });
  return client;
}

function forgetAccountStore(accountId: string): Promise<void> {
  forgetPushAccount(accountId);
  return deleteDbKey(accountId);
}

export const {
  getOrCreateXmtpClient, xmtpClient, switchToAccount, deleteAccount, resetActiveXmtpStore,
  cachedSelfEthAddress, selfEthAddress, syncPreferences, listXmtpInstallations, revokeXmtpInstallation,
} = makeClientLifecycle<Client>({
  accounts: { active: getActiveAccount, list: loadAccounts, setActive: setActiveAccountId, remove: removeAccount },
  store: { deleteFiles: deleteDbFiles, deleteKey: forgetAccountStore, wipe: wipeXmtpStore, forgetSaved: () => Promise.resolve() },
  client: {
    get: getCachedXmtpClient,
    getOrCreate: getOrCreateCachedClient,
    build: buildClientForAccount,
    dispose: resetClientScopedState,
    selfAddressOf: (client) => client.publicIdentity.identifier,
    syncPreferences: (client) => client.preferences.sync(),
    installations: async (client) => (await client.inboxState(true)).installations,
    installationIdOf: (client) => client.installationId,
    revoke: async (client, account, installationId) => {
      const signer = await signerForRecord(account);
      await client.revokeInstallations(signer, [installationId as InstallationId]);
    },
  },
  bumpEpoch: bumpAccountEpoch,
});

export { getCachedXmtpClient, waitForXmtpReady } from './xmtp.state';
export { getLastReadNs, setLastReadNs, getMarkedUnread, setMarkedUnreadFlag, markConvUnreadSynced, markConvReadSynced } from './xmtp.unread';
