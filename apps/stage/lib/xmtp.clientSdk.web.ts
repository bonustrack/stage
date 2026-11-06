import { Client, Group, IdentifierKind } from '@xmtp/browser-sdk';
import type { AccountRecord } from '@stage-labs/client/accounts/types';
import { errorMessage } from '@stage-labs/client/errors';
import { groupIdOfTopic, groupTopicOf, type HmacKeysByTopic } from '@stage-labs/client/xmtp/pushServer';
import {
  canReuseSavedClient,
  installationCreatedAtMs,
  offlineOpenOptions,
  openPersistedClient,
  webXmtpDbPath,
} from '@stage-labs/client/xmtp/clientConfig';
import { isStoreCorruption, isStoreLocked } from '@stage-labs/client/xmtp/clientErrors';
import { secureStorage } from '../platform/storage';
import { perfLog, perfTime } from './perf';
import { XMTP_CODECS, signerForRecord } from './xmtp.codecs.web';
import { clientSlot } from './xmtp.state.web';
import { whileRegistering } from './xmtp.state.core';
import { XMTP_ENV } from './xmtp.types';
import { deleteDbKey, wipeXmtpStore } from './xmtp.dbkey';
import { openFinalizedClient, openWithRecovery, withCreateTimeout, type FinalizeClient } from './xmtp.recover.core';
import type { ClientSdk, GroupName } from './xmtp.client.core';
import { withMainThreadWasm } from './xmtp.wasm.web';
import { guardClientAccess } from './xmtp.clientAccess.web';
import { ignored } from './errorPolicy';
import { afterFirstPages } from './feedLines';
import { historyServerUrl } from './historyServer';
import { forgetFeeds } from './feedSnapshot';
import { forgetStorageIndex } from './storageIndexStore';

export type XmtpClient = Client<unknown>;

const savedKeysFor = (id: string): { address: string; env: string; installation: string; inbox: string } => ({
  address: `xmtp.address.${id}`,
  env: `xmtp.env.${id}`,
  installation: `xmtp.installation.${id}`,
  inbox: `xmtp.inbox.${id}`,
});

const OPFS_POOL_DIR = '.opfs-libxmtp-metadata';
const OPFS_EMPTY_SLOT_BYTES = 4096;
const CREATE_TIMEOUT_MS = 45_000;
const CREATE_TIMEOUT_MESSAGE = 'Opening the local message store timed out.';
const NOISY_OPEN_EVENTS = new Set(['installation-mismatch', 'open-failed']);

interface CreateOpts {
  env: typeof XMTP_ENV;
  dbPath: string;
  codecs: typeof XMTP_CODECS;
  historySyncUrl: string;
  inboxId?: string;
  allowOffline?: boolean;
}

function onlineOpts({ env, dbPath, codecs, historySyncUrl }: CreateOpts): CreateOpts {
  return { env, dbPath, codecs, historySyncUrl };
}

type OpfsEntry = { kind: 'file'; getFile: () => Promise<{ size: number }> } | ({ kind: 'directory' } & OpfsDirectory);

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
    const pool = (await root.getDirectoryHandle(OPFS_POOL_DIR)) as unknown as OpfsDirectory;
    return await dirHasDatabase(pool);
  } catch (e) {
    return !(e instanceof DOMException && e.name === 'NotFoundError');
  }
}

function reportOpenEvent(event: string, savedInstallationId: string | null, e?: unknown): void {
  const detail = { saved: savedInstallationId ?? '', error: e === undefined ? '' : errorMessage(e) };
  perfLog(`xmtp.client.open ${event}`, detail);
  if (NOISY_OPEN_EVENTS.has(event)) console.warn(`[stage] xmtp store open ${event}`, detail);
}

async function openPersisted(
  rec: AccountRecord,
  opts: CreateOpts,
  savedInstallationId: string | null | Promise<string | null>,
): Promise<XmtpClient> {
  const signer = await signerForRecord(rec);
  const opened = await openPersistedClient<XmtpClient>({
    open: () =>
      withCreateTimeout(
        () => Client.create(signer, { ...opts, disableAutoRegister: true }),
        CREATE_TIMEOUT_MS,
        CREATE_TIMEOUT_MESSAGE,
        clientSlot.discard,
      ),
    isRegistered: (client) => client.isRegistered(),
    register: (client) =>
      whileRegistering(async () => {
        await client.register();
      }),
    installationIdOf: (client) => client.installationId ?? '',
    close: clientSlot.discard,
    savedInstallationId,
    retryable: isStoreLocked,
    onEvent: (event, e) => {
      void Promise.resolve(savedInstallationId).then((saved) => {
        reportOpenEvent(event, saved, e);
      });
    },
  });
  return opened.client;
}

function openRecovering(
  rec: AccountRecord,
  opts: CreateOpts,
  savedInstallationId: string | null | Promise<string | null>,
): Promise<XmtpClient> {
  return openWithRecovery(
    { isCorrupt: isStoreCorruption, wipe: () => wipeXmtpStore(rec.id, rec.dbDir), freeInstallationSlot: null },
    (wiped) => (wiped ? openPersisted(rec, onlineOpts(opts), null) : openPersisted(rec, opts, savedInstallationId)),
  );
}

async function openSavedOrOnline(
  rec: AccountRecord,
  opts: CreateOpts,
  savedIfPersisted: Promise<string | null> | null,
  finalize: FinalizeClient<XmtpClient>,
): Promise<XmtpClient> {
  return openFinalizedClient({
    open: () => openRecovering(rec, opts, savedIfPersisted),
    canFallback: (error) => opts.allowOffline === true && !isStoreLocked(error),
    fallback: async () => {
      await secureStorage.delete(savedKeysFor(rec.id).inbox).catch(ignored(undefined, 'cleanup'));
      return openRecovering(rec, onlineOpts(opts), savedIfPersisted);
    },
    finalize: (client) => finalize(client, rec, { markRegistered: true }),
  });
}

async function buildClient(rec: AccountRecord, finalize: FinalizeClient<XmtpClient>): Promise<XmtpClient> {
  const address = rec.address.toLowerCase();
  const keys = savedKeysFor(rec.id);
  const [savedAddress, savedEnv, savedInstallation, savedInbox] = await Promise.all([
    secureStorage.get(keys.address),
    secureStorage.get(keys.env),
    secureStorage.get(keys.installation),
    secureStorage.get(keys.inbox),
  ]);
  const sameAccount = canReuseSavedClient(savedAddress, savedEnv, address, XMTP_ENV);
  const offline = offlineOpenOptions(savedInbox, sameAccount);
  const opts: CreateOpts = {
    env: XMTP_ENV,
    dbPath: webXmtpDbPath(rec.id, XMTP_ENV),
    codecs: XMTP_CODECS,
    historySyncUrl: historyServerUrl(),
    ...offline,
  };
  const savedIfPersisted = sameAccount ? opfsHasDatabase().then((has) => (has ? savedInstallation : null)) : null;
  perfLog('xmtp.client path', { savedAddress, savedEnv, savedInstallation, savedInbox, address, env: XMTP_ENV });
  const client = guardClientAccess(await perfTime('xmtp.client.open', () => openSavedOrOnline(rec, opts, savedIfPersisted, finalize)));
  perfLog('xmtp.client opened', { installation: client.installationId, offline: offline !== null });
  if (offline)
    void afterFirstPages()
      .then(() => client.preferences.fetchInboxState())
      .catch(ignored(undefined, 'optional'));
  try {
    await secureStorage.set(keys.address, address);
    await secureStorage.set(keys.env, XMTP_ENV);
    await secureStorage.set(keys.installation, client.installationId ?? '');
    await secureStorage.set(keys.inbox, client.inboxId ?? '');
    return client;
  } catch (e) {
    clientSlot.discard(client);
    throw e;
  }
}

async function forgetSavedClient(id: string): Promise<void> {
  await forgetFeeds(id);
  await forgetStorageIndex(id).catch(ignored(undefined, 'cleanup'));
  const keys = savedKeysFor(id);
  for (const key of [keys.address, keys.env, keys.installation, keys.inbox]) {
    await secureStorage.delete(key).catch(ignored(undefined, 'cleanup'));
  }
}

async function revokeInstallation(client: XmtpClient, account: AccountRecord, installationId: string): Promise<void> {
  const inboxId = client.inboxId;
  if (!inboxId) throw new Error('XMTP inbox unavailable.');
  const state = await client.preferences.inboxState();
  const target = state.installations.find((i) => i.id === installationId);
  if (!target) throw new Error('Installation not found.');
  const signer = await signerForRecord(account);
  await withMainThreadWasm(() => Client.revokeInstallations(signer, inboxId, [target.bytes], client.env));
}

function normalizeKeys(keys: Awaited<ReturnType<XmtpClient['conversations']['hmacKeys']>>): HmacKeysByTopic {
  const hmacKeys: HmacKeysByTopic = {};
  for (const [id, list] of keys) {
    const topic = id.startsWith('/') ? id : groupTopicOf(id);
    hmacKeys[topic] = list.map((k) => ({ thirtyDayPeriodsSinceEpoch: Number(k.epoch), hmacKey: k.key }));
  }
  return hmacKeys;
}

async function hmacKeysOf(client: XmtpClient, topic?: string): Promise<HmacKeysByTopic> {
  if (topic === undefined) return normalizeKeys(await client.conversations.hmacKeys());
  const id = groupIdOfTopic(topic);
  const conv = id ? await client.conversations.getConversationById(id) : undefined;
  if (!conv) throw new Error('Sender filter conversation is not ready');
  return normalizeKeys(await conv.hmacKeys());
}

async function pushTopicsOf(client: XmtpClient): Promise<string[]> {
  const conversations = await client.conversations.list();
  return [`/xmtp/mls/1/w-${client.installationId ?? ''}/proto`, ...conversations.map((conv) => groupTopicOf(conv.id))];
}

async function groupNamesOf(client: XmtpClient): Promise<GroupName[]> {
  const conversations = await client.conversations.list();
  return conversations.flatMap((conv) => (conv instanceof Group ? [{ id: conv.id, name: conv.name ?? '' }] : []));
}

export const clientSdk: ClientSdk<XmtpClient> = {
  build: buildClient,
  selfAddressOf: (client) => client.accountIdentifier?.identifier ?? null,
  syncPreferences: (client) => client.preferences.sync(),
  installations: async (client) =>
    (await client.preferences.inboxState()).installations.map((i) => ({
      id: i.id,
      createdAt: installationCreatedAtMs(i.clientTimestampNs) ?? undefined,
    })),
  installationIdOf: (client) => client.installationId,
  revoke: revokeInstallation,
  isRegistered: async (address) => {
    const identifier = { identifier: address.toLowerCase(), identifierKind: IdentifierKind.Ethereum };
    const result = await withMainThreadWasm(() => Client.canMessage([identifier], XMTP_ENV));
    return [...result.values()].some(Boolean);
  },
  forgetStore: deleteDbKey,
  forgetSaved: forgetSavedClient,
  push: {
    inboxId: (client) => client.inboxId ?? null,
    signWithInstallationKey: (client, text) => client.signWithInstallationKey(text),
    topics: pushTopicsOf,
    hmacKeys: hmacKeysOf,
    groupNames: groupNamesOf,
  },
};
