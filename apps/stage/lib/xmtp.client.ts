import { Client, PublicIdentity } from '@xmtp/react-native-sdk';
import { getActiveAccount, loadAccounts, setActiveAccountId, removeAccount, type AccountRecord } from './accounts';
import { bumpAccountEpoch } from './accountEpoch';
import { XMTP_CODECS, signerForRecord } from './xmtp.codecs';
import { getCachedXmtpClient, resetClientScopedState, getOrCreateCachedClient } from './xmtp.state';
import { whileRegistering } from './xmtp.state.core';
import type { XmtpEnv } from './xmtp.types';
import { loadOrCreateDbKey, deleteDbKey, deleteDbFiles, ensureDbDir, wipeXmtpStore } from './xmtp.dbkey';
import { createClientForAccount, finalizeClient, isStoreCorruption } from './xmtp.recover';
import { makeClientLifecycle } from './xmtp.client.core';
import { nativeInstallationCreatedAtMs } from '@stage-labs/client/xmtp/clientConfig';
import { forgetPushAccount, recordPushAccount } from './xmtp.dbkeyFs';
import { forgetStorageIndex } from './storageIndexStore';
import { registerPushWithServer } from './pushRegister';

type InstallationId = Parameters<Client['revokeInstallations']>[1][number];

const REGISTERED_BUILD_TIMEOUT_MS = 20_000;

async function openClientForAccount(rec: AccountRecord, env: XmtpEnv): Promise<Client> {
  const dbDirectory = await ensureDbDir(rec.dbDir);
  const dbEncryptionKey = await loadOrCreateDbKey(rec.id);
  let opts = { env, dbDirectory, dbEncryptionKey, codecs: XMTP_CODECS };
  if (rec.registered) {
    let built: Client | null = null;
    try {
      built = await Promise.race<Client | null>([
        Client.build(new PublicIdentity(rec.address, 'ETHEREUM'), opts),
        new Promise<null>((resolve) =>
          setTimeout(() => {
            resolve(null);
          }, REGISTERED_BUILD_TIMEOUT_MS),
        ),
      ]);
    } catch (e) {
      if (isStoreCorruption(e)) {
        await wipeXmtpStore(rec.id, rec.dbDir);
        opts = { ...opts, dbDirectory: await ensureDbDir(rec.dbDir), dbEncryptionKey: await loadOrCreateDbKey(rec.id) };
      }
    }
    if (built) return finalizeClient(built, rec, env, { markRegistered: false });
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
  getOrCreateXmtpClient,
  xmtpClient,
  switchToAccount,
  deleteAccount,
  resetActiveXmtpStore,
  cachedSelfEthAddress,
  selfEthAddress,
  syncPreferences,
  listXmtpInstallations,
  revokeXmtpInstallation,
} = makeClientLifecycle<Client>({
  accounts: { active: getActiveAccount, list: loadAccounts, setActive: setActiveAccountId, remove: removeAccount },
  store: { deleteFiles: deleteDbFiles, deleteKey: forgetAccountStore, wipe: wipeXmtpStore, forgetSaved: forgetStorageIndex },
  client: {
    get: getCachedXmtpClient,
    getOrCreate: getOrCreateCachedClient,
    build: buildClientForAccount,
    ready: registerPushWithServer,
    dispose: resetClientScopedState,
    selfAddressOf: (client) => client.publicIdentity.identifier,
    syncPreferences: (client) => client.preferences.sync(),
    installations: async (client) =>
      (await client.inboxState(true)).installations.map((i) => ({ id: i.id, createdAt: nativeInstallationCreatedAtMs(i.createdAt) })),
    installationIdOf: (client) => client.installationId,
    revoke: async (client, account, installationId) => {
      const signer = await signerForRecord(account);
      await client.revokeInstallations(signer, [installationId as InstallationId]);
    },
  },
  bumpEpoch: bumpAccountEpoch,
});

export async function isXmtpRegistered(address: string): Promise<boolean> {
  const result = await Client.canMessage('production', [new PublicIdentity(address, 'ETHEREUM')]);
  return Object.values(result).some(Boolean);
}
