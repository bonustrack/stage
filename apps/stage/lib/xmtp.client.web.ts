import { Client } from '@xmtp/browser-sdk';
import { secureStorage } from '../platform/storage';
import {
  getActiveAccount, loadAccounts, setActiveAccountId, removeAccount, type AccountRecord,
} from './accounts';
import { getSecure, setSecure } from './cache.shared';
import { perfLog, perfTime } from './perf';
import { bumpAccountEpoch } from './accountEpoch';
import { XMTP_CODECS, signerForRecord } from './xmtp.codecs.web';
import { getCachedXmtpClient, resetClientScopedState, getOrCreateCachedClient } from './xmtp.state.web';
import type { XmtpEnv } from './xmtp.types';
import { deleteDbKey, deleteDbFiles, wipeXmtpStore } from './xmtp.dbkey';
import { historyServerUrl } from './historyServer';
import { openClientForAccount, type CreateOpts } from './xmtp.recover.web';
import { makeClientLifecycle } from './xmtp.client.core';
import { webXmtpDbPath, canReuseSavedClient, installationCreatedAtMs } from '@stage-labs/client/xmtp/clientConfig';
import { ignored, attempt } from './errorPolicy';

const ADDRESS_PREFIX = 'xmtp.address.';
const ENV_PREFIX = 'xmtp.env.';
const INSTALLATION_PREFIX = 'xmtp.installation.';

type WebXmtpClient = Client<unknown>;

function addressKeyFor(id: string): string { return ADDRESS_PREFIX + id; }
function envKeyFor(id: string): string { return ENV_PREFIX + id; }
function installationKeyFor(id: string): string { return INSTALLATION_PREFIX + id; }

const OPFS_POOL_DIR = '.opfs-libxmtp-metadata';
const OPFS_EMPTY_SLOT_BYTES = 4096;

type OpfsEntry =
  | { kind: 'file'; getFile: () => Promise<{ size: number }> }
  | ({ kind: 'directory' } & OpfsDirectory);

interface OpfsDirectory {
  values: () => AsyncIterable<OpfsEntry>;
}

async function dirHasDatabase(dir: OpfsDirectory): Promise<boolean> {
  for await (const entry of dir.values()) {
    if (entry.kind === 'directory') {
      if (await dirHasDatabase(entry)) return true;
    } else if ((await entry.getFile()).size > OPFS_EMPTY_SLOT_BYTES) {
      return true;
    }
  }
  return false;
}

async function opfsHasDatabase(): Promise<boolean> {
  try {
    const root = await navigator.storage.getDirectory();
    const pool = await root.getDirectoryHandle(OPFS_POOL_DIR) as unknown as OpfsDirectory;
    return await dirHasDatabase(pool);
  } catch (e) {
    return !(e instanceof DOMException && e.name === 'NotFoundError');
  }
}

async function buildClientForAccount(rec: AccountRecord, env: XmtpEnv): Promise<WebXmtpClient> {
  const address = rec.address.toLowerCase();
  const opts: CreateOpts = { env, dbPath: webXmtpDbPath(rec.id, env), codecs: XMTP_CODECS, historySyncUrl: historyServerUrl(env) };
  const [savedAddress, savedEnv, savedInstallation] = await Promise.all([
    getSecure(addressKeyFor(rec.id)), getSecure(envKeyFor(rec.id)), getSecure(installationKeyFor(rec.id)),
  ]);
  const reusable = canReuseSavedClient(savedAddress, savedEnv, address, env) && await opfsHasDatabase();
  perfLog('xmtp.client path', { reusable, savedAddress, savedEnv, savedInstallation, address, env });
  const opened = await perfTime('xmtp.client.open', () =>
    openClientForAccount(rec, env, opts, reusable ? savedInstallation : null));
  perfLog('xmtp.client opened', { registered: opened.registered, installation: opened.client.installationId });
  await setSecure(addressKeyFor(rec.id), address);
  await setSecure(envKeyFor(rec.id), env);
  await setSecure(installationKeyFor(rec.id), opened.client.installationId ?? '');
  return opened.client;
}

function disposeCachedClient(): void {
  const client = getCachedXmtpClient();
  if (client) attempt(() => { client.close(); }, 'cleanup');
  resetClientScopedState();
}

async function forgetSavedClient(id: string): Promise<void> {
  await secureStorage.delete(addressKeyFor(id)).catch(ignored(undefined, 'cleanup'));
  await secureStorage.delete(envKeyFor(id)).catch(ignored(undefined, 'cleanup'));
  await secureStorage.delete(installationKeyFor(id)).catch(ignored(undefined, 'cleanup'));
}

async function revokeInstallation(client: WebXmtpClient, account: AccountRecord, installationId: string): Promise<void> {
  const inboxId = client.inboxId;
  if (!inboxId) throw new Error('XMTP inbox unavailable.');
  const state = await client.preferences.inboxState();
  const target = state.installations.find(i => i.id === installationId);
  if (!target) throw new Error('Installation not found.');
  const signer = await signerForRecord(account);
  await Client.revokeInstallations(signer, inboxId, [target.bytes], client.env);
}

export const {
  getOrCreateXmtpClient, xmtpClient, switchToAccount, deleteAccount, resetActiveXmtpStore,
  cachedSelfEthAddress, selfEthAddress, syncPreferences, listXmtpInstallations, revokeXmtpInstallation,
} = makeClientLifecycle<WebXmtpClient>({
  accounts: { active: getActiveAccount, list: loadAccounts, setActive: setActiveAccountId, remove: removeAccount },
  store: { deleteFiles: deleteDbFiles, deleteKey: deleteDbKey, wipe: wipeXmtpStore, forgetSaved: forgetSavedClient },
  client: {
    get: getCachedXmtpClient,
    getOrCreate: getOrCreateCachedClient,
    build: buildClientForAccount,
    dispose: disposeCachedClient,
    selfAddressOf: (client) => client.accountIdentifier?.identifier ?? null,
    syncPreferences: (client) => client.preferences.sync(),
    installations: async (client) => (await client.preferences.inboxState()).installations
      .map(i => ({ id: i.id, createdAt: installationCreatedAtMs(i.clientTimestampNs) ?? undefined })),
    installationIdOf: (client) => client.installationId,
    revoke: revokeInstallation,
  },
  bumpEpoch: bumpAccountEpoch,
});

export { getCachedXmtpClient, waitForXmtpReady } from './xmtp.state.web';
export { getLastReadNs, setLastReadNs, getMarkedUnread, setMarkedUnreadFlag, markConvUnreadSynced, markConvReadSynced } from './xmtp.unread';
