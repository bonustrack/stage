import { Client, IdentifierKind } from '@xmtp/browser-sdk';
import { secureStorage } from '../platform/storage';
import {
  getActiveAccount, loadAccounts, setActiveAccountId, removeAccount, type AccountRecord,
} from './accounts';
import { perfLog, perfTime } from './perf';
import { bumpAccountEpoch } from './accountEpoch';
import { XMTP_CODECS, signerForRecord } from './xmtp.codecs.web';
import { getCachedXmtpClient, resetClientScopedState, getOrCreateCachedClient } from './xmtp.state.web';
import type { XmtpEnv } from './xmtp.types';
import { deleteDbKey, deleteDbFiles, wipeXmtpStore } from './xmtp.dbkey';
import { openClientForAccount, onlineOpts, type CreateOpts } from './xmtp.recover.web';
import { makeClientLifecycle } from './xmtp.client.core';
import { withMainThreadWasm } from './xmtp.wasm.web';
import {
  webXmtpDbPath, canReuseSavedClient, installationCreatedAtMs, offlineOpenOptions,
} from '@stage-labs/client/xmtp/clientConfig';
import { isStoreLocked } from '@stage-labs/client/xmtp/clientErrors';
import { ignored, attempt } from './errorPolicy';
import { afterFirstPages } from './feedLines';
import { historyServerUrl } from './historyServer';
import { forgetFeeds } from './feedSnapshot';
import { forgetStorageIndex } from './storageIndexStore';
import { registerPushWithServer } from './pushRegister.web';
import { clientFinalizer } from './xmtp.recover.core';
import { openFinalizedClient } from './xmtp.finalize.core';
import { guardClientAccess } from './xmtp.clientAccess.web';

type WebXmtpClient = Client<unknown>;

function addressKeyFor(id: string): string { return `xmtp.address.${id}`; }
function envKeyFor(id: string): string { return `xmtp.env.${id}`; }
function installationKeyFor(id: string): string { return `xmtp.installation.${id}`; }
function inboxKeyFor(id: string): string { return `xmtp.inbox.${id}`; }

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

const finalizeClient = clientFinalizer<WebXmtpClient>({ discard: client => { client.close(); } });

async function openSavedOrOnline(
  rec: AccountRecord, env: XmtpEnv, opts: CreateOpts, savedIfPersisted: Promise<string | null> | null,
): Promise<WebXmtpClient> {
  return openFinalizedClient({
    open: async () => (await openClientForAccount(rec, env, opts, savedIfPersisted)).client,
    canFallback: error => opts.allowOffline === true && !isStoreLocked(error),
    fallback: async () => {
      await secureStorage.delete(inboxKeyFor(rec.id)).catch(ignored(undefined, 'cleanup'));
      return (await openClientForAccount(rec, env, onlineOpts(opts), savedIfPersisted)).client;
    },
    finalize: client => finalizeClient(client, rec, env, { markRegistered: true }),
  });
}

async function buildClientForAccount(rec: AccountRecord, env: XmtpEnv): Promise<WebXmtpClient> {
  const address = rec.address.toLowerCase();
  const [savedAddress, savedEnv, savedInstallation, savedInbox] = await Promise.all([
    secureStorage.get(addressKeyFor(rec.id)), secureStorage.get(envKeyFor(rec.id)),
    secureStorage.get(installationKeyFor(rec.id)), secureStorage.get(inboxKeyFor(rec.id)),
  ]);
  const sameAccount = canReuseSavedClient(savedAddress, savedEnv, address, env);
  const offline = offlineOpenOptions(savedInbox, sameAccount);
  const opts: CreateOpts = {
    env, dbPath: webXmtpDbPath(rec.id, env), codecs: XMTP_CODECS, historySyncUrl: historyServerUrl(env), ...offline,
  };
  const savedIfPersisted = sameAccount
    ? opfsHasDatabase().then((has) => (has ? savedInstallation : null))
    : null;
  perfLog('xmtp.client path', { savedAddress, savedEnv, savedInstallation, savedInbox, address, env });
  const client = guardClientAccess(await perfTime('xmtp.client.open', () => openSavedOrOnline(rec, env, opts, savedIfPersisted)));
  perfLog('xmtp.client opened', { installation: client.installationId, offline: offline !== null });
  if (offline) void afterFirstPages().then(() => client.preferences.fetchInboxState()).catch(ignored(undefined, 'optional'));
  try {
    await secureStorage.set(addressKeyFor(rec.id), address);
    await secureStorage.set(envKeyFor(rec.id), env);
    await secureStorage.set(installationKeyFor(rec.id), client.installationId ?? '');
    await secureStorage.set(inboxKeyFor(rec.id), client.inboxId ?? '');
    return client;
  } catch (e) {
    attempt(() => { client.close(); }, 'cleanup');
    throw e;
  }
}

function disposeCachedClient(): void {
  const client = getCachedXmtpClient();
  if (client) attempt(() => { client.close(); }, 'cleanup');
  resetClientScopedState();
}

async function forgetSavedClient(id: string): Promise<void> {
  await forgetFeeds(id);
  await forgetStorageIndex(id).catch(ignored(undefined, 'cleanup'));
  for (const key of [addressKeyFor(id), envKeyFor(id), installationKeyFor(id), inboxKeyFor(id)]) {
    await secureStorage.delete(key).catch(ignored(undefined, 'cleanup'));
  }
}

async function revokeInstallation(client: WebXmtpClient, account: AccountRecord, installationId: string): Promise<void> {
  const inboxId = client.inboxId;
  if (!inboxId) throw new Error('XMTP inbox unavailable.');
  const state = await client.preferences.inboxState();
  const target = state.installations.find(i => i.id === installationId);
  if (!target) throw new Error('Installation not found.');
  const signer = await signerForRecord(account);
  await withMainThreadWasm(() => Client.revokeInstallations(signer, inboxId, [target.bytes], client.env));
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
    ready: registerPushWithServer,
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

export async function isXmtpRegistered(address: string): Promise<boolean> {
  const identifier = { identifier: address.toLowerCase(), identifierKind: IdentifierKind.Ethereum };
  const result = await withMainThreadWasm(() => Client.canMessage([identifier], 'production'));
  return [...result.values()].some(Boolean);
}
