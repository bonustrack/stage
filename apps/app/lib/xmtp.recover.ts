
import * as SecureStore from 'expo-secure-store';
import { Client, PublicIdentity } from '@xmtp/react-native-sdk';
import {
  getActiveAccount, markRegistered, setActiveAccountId,
  type AccountRecord,
} from './accounts';
import { registerPushWithDaemon } from './push';
import { XMTP_CODECS, signerForRecord } from './xmtp.codecs';
import { setCachedXmtpClient } from './xmtp.state';
import { type XmtpEnv } from './xmtp.types';
import { loadOrCreateDbKey, ensureDbDir, wipeXmtpStore } from './xmtp.dbkey';

const ENV_KEY = 'xmtp.env';

const INSTALLATION_LIMIT_MESSAGE =
  'This wallet already has XMTP set up on too many devices (installation limit reached). ' +
  'Messaging is unavailable for this account — wallet features still work.';

export interface CreateOpts {
  env: XmtpEnv;
  dbDirectory: string;
  dbEncryptionKey: Uint8Array;
  codecs: typeof XMTP_CODECS;
}

class XmtpInstallationLimitError extends Error {
  constructor() { super(INSTALLATION_LIMIT_MESSAGE); this.name = 'XmtpInstallationLimitError'; }
}

export async function ensureActiveAccount(): Promise<void> {
  await getActiveAccount();
}

const CREATE_TIMEOUT_MESSAGE = 'XMTP.create timed out (native handshake hang)';

const STORE_CORRUPTION = [
  'PRAGMA key', 'StorageError', 'incorrect value', CREATE_TIMEOUT_MESSAGE,
];
export function isStoreCorruption(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return STORE_CORRUPTION.some(sig => msg.includes(sig));
}

const CREATE_TIMEOUT_MS = 30_000;
async function createWithTimeout(
  signer: Awaited<ReturnType<typeof signerForRecord>>, opts: CreateOpts,
): Promise<Client> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => { reject(new Error(CREATE_TIMEOUT_MESSAGE)); },
      CREATE_TIMEOUT_MS,
    );
  });
  try {
    return await Promise.race<Client>([Client.create(signer, opts), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

const INSTALLATION_LIMIT = [
  '10/10',
  'has already registered',
  'already registered',
  'Please revoke existing installations',
  'Cannot register a new installation',
];
function isInstallationLimit(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return INSTALLATION_LIMIT.some(sig => msg.toLowerCase().includes(sig.toLowerCase()));
}

async function tryFreeInstallationSlot(rec: AccountRecord, env: XmtpEnv): Promise<boolean> {
  try {
    const identity = new PublicIdentity(rec.address, 'ETHEREUM');
    const inboxId = await Client.getOrCreateInboxId(identity, env);
    const states = await Client.inboxStatesForInboxIds(env, [inboxId]);
    const installs = states[0]?.installations ?? [];
    if (installs.length === 0) return false;
    const oldest = [...installs].sort(
      (a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0),
    )[0];
    if (!oldest?.id) return false;
    const signer = await signerForRecord(rec);
    await Client.revokeInstallations(
      env, signer, inboxId,
      [oldest.id as unknown as Parameters<typeof Client.revokeInstallations>[3][number]],
    );
    return true;
  } catch {
    return false;
  }
}

async function finalizeClient(created: Client, rec: AccountRecord, env: XmtpEnv): Promise<Client> {
  setCachedXmtpClient(created);
  await markRegistered(rec.id);
  await setActiveAccountId(rec.id);
  await SecureStore.setItemAsync(ENV_KEY, env);
  void registerPushWithDaemon(created);
  return created;
}

export async function createClientForAccount(
  rec: AccountRecord, env: XmtpEnv, opts: CreateOpts,
  recovered = false, slotFreed = false,
): Promise<Client> {
  const signer = await signerForRecord(rec);
  try {
    const created = await createWithTimeout(signer, opts);
    return await finalizeClient(created, rec, env);
  } catch (e) {
    if (!recovered && isStoreCorruption(e)) {
      await wipeXmtpStore(rec.id, rec.dbDir);
      const dbDirectory = await ensureDbDir(rec.dbDir);
      const dbEncryptionKey = await loadOrCreateDbKey(rec.id);
      return createClientForAccount(
        rec, env, { ...opts, dbDirectory, dbEncryptionKey }, true, slotFreed,
      );
    }
    if (!slotFreed && isInstallationLimit(e)) {
      const freed = await tryFreeInstallationSlot(rec, env);
      if (freed) return createClientForAccount(rec, env, opts, recovered, true);
      throw new XmtpInstallationLimitError();
    }
    if (isInstallationLimit(e)) throw new XmtpInstallationLimitError();
    throw e;
  }
}
