import { Client, PublicIdentity, getAllPushTopics, getHmacKeys } from '@xmtp/react-native-sdk';
import type { AccountRecord } from '@stage-labs/client/accounts/types';
import type { HmacKeysByTopic } from '@stage-labs/client/xmtp/pushServer';
import { isStoreCorruption as isStoreCorruptionCore } from '@stage-labs/client/xmtp/clientErrors';
import { settleWithin } from '@stage-labs/client/timing';
import { XMTP_CODECS, signerForRecord } from './xmtp.codecs';
import { whileRegistering } from './xmtp.state.core';
import { XMTP_ENV } from './xmtp.types';
import { loadOrCreateDbKey, deleteDbKey, wipeXmtpStore } from './xmtp.dbkey';
import { ensureDbDir, forgetPushAccount, recordPushAccount } from './xmtp.dbkeyFs';
import { openWithRecovery, withCreateTimeout, withStoreRecovery, type FinalizeClient, type StoreRecovery } from './xmtp.recover.core';
import type { ClientSdk, GroupName } from './xmtp.client.core';
import { nativeInstallationCreatedAtMs } from './xmtp.sdk.native.shapes';
import { forgetStorageIndex } from './storageIndexStore';
import { recover } from './errorPolicy';

type InstallationId = Parameters<Client['revokeInstallations']>[1][number];

const REGISTERED_BUILD_TIMEOUT_MS = 20_000;
const CREATE_TIMEOUT_MS = 60_000;
const CREATE_TIMEOUT_MESSAGE = 'XMTP.create timed out (native handshake hang)';

interface CreateOpts {
  env: typeof XMTP_ENV;
  dbDirectory: string;
  dbEncryptionKey: Uint8Array;
  codecs: typeof XMTP_CODECS;
}

function identityOf(address: string): PublicIdentity {
  return new PublicIdentity(address, 'ETHEREUM');
}

function isStoreCorruption(err: unknown): boolean {
  return isStoreCorruptionCore(err, [CREATE_TIMEOUT_MESSAGE]);
}

function storeOf(rec: AccountRecord): StoreRecovery {
  return { isCorrupt: isStoreCorruption, wipe: () => wipeXmtpStore(rec.id, rec.dbDir) };
}

async function storeOptions(rec: AccountRecord): Promise<CreateOpts> {
  const dbDirectory = await ensureDbDir(rec.dbDir);
  const dbEncryptionKey = await loadOrCreateDbKey(rec.id);
  return { env: XMTP_ENV, dbDirectory, dbEncryptionKey, codecs: XMTP_CODECS };
}

async function freeOldestInstallation(rec: AccountRecord): Promise<boolean> {
  try {
    const inboxId = await Client.getOrCreateInboxId(identityOf(rec.address), XMTP_ENV);
    const states = await Client.inboxStatesForInboxIds(XMTP_ENV, [inboxId]);
    const installs = states[0]?.installations ?? [];
    if (installs.length === 0) return false;
    const oldest = [...installs].sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0))[0];
    if (!oldest?.id) return false;
    const signer = await signerForRecord(rec);
    await Client.revokeInstallations(XMTP_ENV, signer, inboxId, [oldest.id as Parameters<typeof Client.revokeInstallations>[3][number]]);
    return true;
  } catch {
    return false;
  }
}

function createClient(rec: AccountRecord, opts: CreateOpts): Promise<Client> {
  return openWithRecovery({ ...storeOf(rec), freeInstallationSlot: () => freeOldestInstallation(rec) }, async (wiped) => {
    const fresh = wiped ? await storeOptions(rec) : opts;
    const signer = await signerForRecord(rec);
    return withCreateTimeout(() => Client.create(signer, fresh), CREATE_TIMEOUT_MS, CREATE_TIMEOUT_MESSAGE);
  });
}

async function buildRegistered(rec: AccountRecord, opts: CreateOpts): Promise<Client | null> {
  try {
    return await settleWithin<Client | null>(Client.build(identityOf(rec.address), opts), REGISTERED_BUILD_TIMEOUT_MS, null);
  } catch (e) {
    if (isStoreCorruption(e)) throw e;
    return null;
  }
}

async function openClient(rec: AccountRecord, finalize: FinalizeClient<Client>): Promise<Client> {
  let opts = await storeOptions(rec);
  if (rec.registered) {
    const built = await withStoreRecovery(
      storeOf(rec),
      () => buildRegistered(rec, opts),
      async () => {
        opts = await storeOptions(rec);
        return null;
      },
    );
    if (built) return finalize(built, rec, { markRegistered: false });
  }
  return whileRegistering(async () => finalize(await createClient(rec, opts), rec, { markRegistered: true }));
}

async function hmacKeysOf(client: Client): Promise<HmacKeysByTopic> {
  const keys = await getHmacKeys(client.installationId);
  const hmacKeys: HmacKeysByTopic = {};
  for (const [topic, entry] of Object.entries(keys.hmacKeys)) hmacKeys[topic] = entry.values;
  return hmacKeys;
}

async function groupNamesOf(client: Client): Promise<GroupName[]> {
  const groups = await client.conversations.listGroups().catch(recover('push.hiddenGroups', []));
  const names: GroupName[] = [];
  for (const group of groups) names.push({ id: group.id, name: await group.name().catch(recover('push.hiddenGroups', '')) });
  return names;
}

export const clientSdk: ClientSdk<Client> = {
  build: async (rec, finalize) => {
    const client = await openClient(rec, finalize);
    recordPushAccount({ id: rec.id, address: rec.address, inboxId: client.inboxId, dbDir: rec.dbDir, env: XMTP_ENV });
    return client;
  },
  selfAddressOf: (client) => client.publicIdentity.identifier,
  syncPreferences: (client) => client.preferences.sync(),
  installations: async (client) =>
    (await client.inboxState(true)).installations.map((i) => ({ id: i.id, createdAt: nativeInstallationCreatedAtMs(i.createdAt) })),
  installationIdOf: (client) => client.installationId,
  revoke: async (client, account, installationId) => {
    const signer = await signerForRecord(account);
    await client.revokeInstallations(signer, [installationId as InstallationId]);
  },
  isRegistered: async (address) => {
    const result = await Client.canMessage(XMTP_ENV, [identityOf(address)]);
    return Object.values(result).some(Boolean);
  },
  forgetStore: (accountId) => {
    forgetPushAccount(accountId);
    return deleteDbKey(accountId);
  },
  forgetSaved: forgetStorageIndex,
  push: {
    inboxId: (client) => client.inboxId,
    signWithInstallationKey: (client, text) => client.signWithInstallationKey(text),
    topics: (client) => getAllPushTopics(client.installationId),
    hmacKeys: hmacKeysOf,
    groupNames: groupNamesOf,
  },
};
