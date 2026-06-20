
import * as SecureStore from 'expo-secure-store';
import { Client, PublicIdentity, type Conversation } from '@xmtp/react-native-sdk';
import {
  getActiveAccount,
  loadAccounts, setActiveAccountId, removeAccount, clearAllAccounts,
  type AccountRecord,
} from './accounts';
import { registerPushWithDaemon } from './push';
import { getSecure, setSecure } from './cache';
import { bumpAccountEpoch } from './accountEpoch';
import { XMTP_CODECS } from './xmtp.codecs';
import {
  getCachedXmtpClient, setCachedXmtpClient, resetClientScopedState,
} from './xmtp.state';
import { type XmtpEnv, convIdOfLine } from './xmtp.types';
import {
  loadOrCreateDbKey, deleteDbKey, deleteLegacyDbKey, deleteDbFiles,
  ensureDbDir, wipeXmtpStore,
} from './xmtp.dbkey';
import { createClientForAccount, isStoreCorruption } from './xmtp.recover';
import { signerForRecord } from './xmtp.codecs';

export { getCachedXmtpClient, waitForXmtpReady } from './xmtp.state';
export { ensureActiveAccount } from './xmtp.recover';

export class NoAccountError extends Error {
  constructor() { super('No account — onboarding not completed yet.'); this.name = 'NoAccountError'; }
}

const ENV_KEY = 'xmtp.env';

export async function getOrCreateXmtpClient(env: XmtpEnv = 'production'): Promise<Client> {
  const cached = getCachedXmtpClient();
  if (cached) return cached;
  if (inFlightCreate) return inFlightCreate;
  inFlightCreate = (async () => {
    const account = await getActiveAccount();
    if (!account) throw new NoAccountError();
    return buildClientForAccount(account, env);
  })();
  try { return await inFlightCreate; } finally { inFlightCreate = null; }
}
let inFlightCreate: Promise<Client> | null = null;

async function buildClientForAccount(rec: AccountRecord, env: XmtpEnv): Promise<Client> {
  const dbDirectory = await ensureDbDir(rec.dbDir);
  const dbEncryptionKey = await loadOrCreateDbKey(rec.id);
  let opts = { env, dbDirectory, dbEncryptionKey, codecs: XMTP_CODECS };
  if (rec.registered) {
    try {
      const built = await Promise.race<Client | null>([
        Client.build(new PublicIdentity(rec.address, 'ETHEREUM'), opts),
        new Promise<null>((resolve) => setTimeout(() => { resolve(null); }, 20_000)),
      ]);
      if (built) {
        setCachedXmtpClient(built);
        await setActiveAccountId(rec.id);
        await SecureStore.setItemAsync(ENV_KEY, env);
        void registerPushWithDaemon(built);
        return built;
      }
    } catch (e) {
      if (isStoreCorruption(e)) {
        await wipeXmtpStore(rec.id, rec.dbDir);
        const dir = await ensureDbDir(rec.dbDir);
        const key = await loadOrCreateDbKey(rec.id);
        opts = { env, dbDirectory: dir, dbEncryptionKey: key, codecs: XMTP_CODECS };
      }
    }
  }
  return createClientForAccount(rec, env, opts);
}

export async function switchToAccount(id: string, env: XmtpEnv = 'production'): Promise<Client> {
  const list = await loadAccounts();
  const rec = list.find(a => a.id === id);
  if (!rec) throw new Error('Account not found.');
  resetClientScopedState();
  await setActiveAccountId(id);
  try {
    const client = await buildClientForAccount(rec, env);
    bumpAccountEpoch();
    return client;
  } catch (e) {
    bumpAccountEpoch();
    throw e;
  }
}

export async function deleteAccount(id: string): Promise<void> {
  const list = await loadAccounts();
  const rec = list.find(a => a.id === id);
  await removeAccount(id);
  if (rec) deleteDbFiles(rec.dbDir);
  await deleteDbKey(id);
  resetClientScopedState();
}

export async function resetXmtpClient(): Promise<void> {
  resetClientScopedState();
  await SecureStore.deleteItemAsync(ENV_KEY).catch(() => undefined);
  const removed = await clearAllAccounts();
  await Promise.all(removed.map(a => deleteDbKey(a.id)));
  await deleteLegacyDbKey();
  const dirs = new Set<string>(['xmtp', ...removed.map(a => a.dbDir)]);
  for (const name of dirs) deleteDbFiles(name);
}

export interface XmtpInstallation {
  id: string;
  createdAt: number | undefined;
  current: boolean;
}

export async function listXmtpInstallations(): Promise<XmtpInstallation[]> {
  const client = getCachedXmtpClient() ?? await getOrCreateXmtpClient('production');
  const state = await client.inboxState(true);
  const current = client.installationId;
  return state.installations
    .map(i => ({ id: i.id, createdAt: i.createdAt, current: i.id === current }))
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
}

export async function revokeXmtpInstallation(installationId: string): Promise<void> {
  const client = getCachedXmtpClient() ?? await getOrCreateXmtpClient('production');
  const account = await getActiveAccount();
  if (!account) throw new NoAccountError();
  const signer = await signerForRecord(account);
  await client.revokeInstallations(
    signer,
    [installationId as unknown as Parameters<typeof client.revokeInstallations>[1][number]],
  );
}

const LAST_READ_PREFIX = 'unread.lastRead.';
export async function getLastReadNs(convId: string): Promise<number> {
  const raw = await getSecure(LAST_READ_PREFIX + convId);
  if (!raw) return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}
export async function setLastReadNs(convId: string, ns: number): Promise<void> {
  await setSecure(LAST_READ_PREFIX + convId, String(ns));
}

export async function markConvReadSynced(convId: string): Promise<void> {
  await setLastReadNs(convId, Date.now() * 1_000_000);
}

export async function markConvUnreadSynced(convId: string): Promise<void> {
  await setLastReadNs(convId, 0);
}

export async function syncPreferences(): Promise<void> {
  try {
    const client = getCachedXmtpClient();
    await (client as unknown as { preferences?: { sync?: () => Promise<unknown> } })?.preferences?.sync?.();
  } catch { }
}

export async function convOfLine(line: string): Promise<Conversation | null> {
  const convId = convIdOfLine(line);
  if (!convId) return null;
  const client = getCachedXmtpClient() ?? await getOrCreateXmtpClient('production');
  const conv = await client.conversations.findConversation(convId as unknown as Parameters<typeof client.conversations.findConversation>[0])
    .catch(() => null);
  return conv ?? null;
}
