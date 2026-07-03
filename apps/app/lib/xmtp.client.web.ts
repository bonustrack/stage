
import { Client, ConsentState, IdentifierKind, type Conversation } from '@xmtp/browser-sdk';
import { secureStorage } from '../platform/storage';
import {
  getActiveAccount, markRegistered,
  loadAccounts, setActiveAccountId, removeAccount, clearAllAccounts,
  type AccountRecord,
} from './accounts';
import { getSecure, setSecure } from './cache';
import { bumpAccountEpoch } from './accountEpoch';
import { XMTP_CODECS, signerForRecord } from './xmtp.codecs.web';
import {
  getCachedXmtpClient, setCachedXmtpClient, resetClientScopedState,
} from './xmtp.state.web';
import { type XmtpEnv, convIdOfLine, lineOfConv } from './xmtp.types';
import { deleteDbKey, deleteLegacyDbKey, deleteDbFiles } from './xmtp.dbkey.web';
import {
  webXmtpDbPath, canReuseSavedClient, installationCreatedAtMs,
} from '@stage-labs/client/xmtp/clientConfig';

export { getCachedXmtpClient, waitForXmtpReady } from './xmtp.state.web';

export async function ensureActiveAccount(): Promise<void> {
  await getActiveAccount();
}

export class NoAccountError extends Error {
  constructor() { super('No account — onboarding not completed yet.'); this.name = 'NoAccountError'; }
}

const ENV_KEY = 'xmtp.env';
const ADDRESS_PREFIX = 'xmtp.address.';
const ENV_PREFIX = 'xmtp.env.';

type WebXmtpClient = Client<unknown>;

function addressKeyFor(id: string): string { return ADDRESS_PREFIX + id; }
function envKeyFor(id: string): string { return ENV_PREFIX + id; }

export async function getOrCreateXmtpClient(env: XmtpEnv = 'production'): Promise<WebXmtpClient> {
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
let inFlightCreate: Promise<WebXmtpClient> | null = null;

async function finalizeClient(
  client: WebXmtpClient, rec: AccountRecord, env: XmtpEnv,
): Promise<WebXmtpClient> {
  setCachedXmtpClient(client);
  await setActiveAccountId(rec.id);
  await secureStorage.set(ENV_KEY, env);
  return client;
}

async function buildClientForAccount(rec: AccountRecord, env: XmtpEnv): Promise<WebXmtpClient> {
  const address = rec.address.toLowerCase();
  const dbPath = webXmtpDbPath(rec.id, env);
  const opts = { env, dbPath, codecs: XMTP_CODECS } as Parameters<typeof Client.create>[1];
  const savedAddress = await getSecure(addressKeyFor(rec.id));
  const savedEnv = await getSecure(envKeyFor(rec.id));
  if (canReuseSavedClient(savedAddress, savedEnv, address, env)) {
    try {
      const built = await Client.build(
        { identifier: address, identifierKind: IdentifierKind.Ethereum },
        opts,
      );
      return await finalizeClient(built, rec, env);
    } catch { }
  }
  const signer = await signerForRecord(rec);
  const created = await Client.create(signer, opts);
  await setSecure(addressKeyFor(rec.id), address);
  await setSecure(envKeyFor(rec.id), env);
  await markRegistered(rec.id);
  return finalizeClient(created, rec, env);
}

function disposeCachedClient(): void {
  const client = getCachedXmtpClient();
  if (client) { try { client.close(); } catch { } }
  resetClientScopedState();
}

export async function switchToAccount(id: string, env: XmtpEnv = 'production'): Promise<WebXmtpClient> {
  const list = await loadAccounts();
  const rec = list.find(a => a.id === id);
  if (!rec) throw new Error('Account not found.');
  disposeCachedClient();
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

async function forgetSavedClient(id: string): Promise<void> {
  await secureStorage.delete(addressKeyFor(id)).catch(() => undefined);
  await secureStorage.delete(envKeyFor(id)).catch(() => undefined);
}

export async function deleteAccount(id: string): Promise<void> {
  const list = await loadAccounts();
  const rec = list.find(a => a.id === id);
  await removeAccount(id);
  if (rec) deleteDbFiles(rec.dbDir);
  await deleteDbKey(id);
  await forgetSavedClient(id);
  disposeCachedClient();
}

export async function resetXmtpClient(): Promise<void> {
  disposeCachedClient();
  await secureStorage.delete(ENV_KEY).catch(() => undefined);
  const removed = await clearAllAccounts();
  await Promise.all(removed.map(a => deleteDbKey(a.id)));
  await Promise.all(removed.map(a => forgetSavedClient(a.id)));
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
  const state = await client.preferences.inboxState();
  const current = client.installationId;
  return state.installations
    .map(i => ({
      id: i.id,
      createdAt: installationCreatedAtMs(i.clientTimestampNs) ?? undefined,
      current: i.id === current,
    }))
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
}

export async function revokeXmtpInstallation(installationId: string): Promise<void> {
  const client = getCachedXmtpClient() ?? await getOrCreateXmtpClient('production');
  const account = await getActiveAccount();
  if (!account) throw new NoAccountError();
  const inboxId = client.inboxId;
  if (!inboxId) throw new Error('XMTP inbox unavailable.');
  const state = await client.preferences.inboxState();
  const target = state.installations.find(i => i.id === installationId);
  if (!target) throw new Error('Installation not found.');
  const signer = await signerForRecord(account);
  await Client.revokeInstallations(signer, inboxId, [target.bytes], client.env);
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
  try {
    const conv = await convOfLine(lineOfConv(convId));
    if (conv && (await conv.consentState()) !== ConsentState.Allowed) {
      await conv.updateConsentState(ConsentState.Allowed);
    }
  } catch { }
}

export async function markConvUnreadSynced(convId: string): Promise<void> {
  await setLastReadNs(convId, 0);
  try {
    const conv = await convOfLine(lineOfConv(convId));
    if (conv && (await conv.consentState()) !== ConsentState.Unknown) {
      await conv.updateConsentState(ConsentState.Unknown);
    }
  } catch { }
}

export async function syncPreferences(): Promise<void> {
  try {
    await getCachedXmtpClient()?.preferences.sync();
  } catch { }
}

export async function convOfLine(line: string): Promise<Conversation | null> {
  const convId = convIdOfLine(line);
  if (!convId) return null;
  const client = getCachedXmtpClient() ?? await getOrCreateXmtpClient('production');
  const conv = await client.conversations.getConversationById(convId).catch(() => undefined);
  return conv ?? null;
}
