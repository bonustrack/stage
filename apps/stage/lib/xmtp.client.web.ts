import { Client, ConsentState, type Conversation } from '@xmtp/browser-sdk';
import { secureStorage } from '../platform/storage';
import {
  getActiveAccount,
  loadAccounts, setActiveAccountId, removeAccount,
  type AccountRecord,
} from './accounts';
import { getSecure, setSecure } from './cache';
import { perfLog, perfTime } from './perf';
import { bumpAccountEpoch } from './accountEpoch';
import { XMTP_CODECS, signerForRecord } from './xmtp.codecs.web';
import {
  getCachedXmtpClient, resetClientScopedState, getOrCreateCachedClient } from './xmtp.state.web';
import { type XmtpEnv, convIdOfLine, lineOfConv } from './xmtp.types';
import { deleteDbKey, deleteDbFiles } from './xmtp.dbkey';
import { historyServerUrl } from './historyServer';
import { openClientForAccount, type CreateOpts } from './xmtp.recover.web';
import { markConvReadSynced as markConvReadLocally } from './xmtp.unread';
import { webXmtpDbPath, canReuseSavedClient, installationCreatedAtMs } from '@stage-labs/client/xmtp/clientConfig';

export { getCachedXmtpClient, waitForXmtpReady } from './xmtp.state.web';
export { ensureActiveAccount } from './xmtp.recover.web';

export class NoAccountError extends Error {
  constructor() { super('No account: onboarding not completed yet.'); this.name = 'NoAccountError'; }
}

const ADDRESS_PREFIX = 'xmtp.address.';
const ENV_PREFIX = 'xmtp.env.';
const INSTALLATION_PREFIX = 'xmtp.installation.';

type WebXmtpClient = Client<unknown>;

function addressKeyFor(id: string): string { return ADDRESS_PREFIX + id; }
function envKeyFor(id: string): string { return ENV_PREFIX + id; }
function installationKeyFor(id: string): string { return INSTALLATION_PREFIX + id; }

export function cachedSelfEthAddress(): string | null {
  return getCachedXmtpClient()?.accountIdentifier?.identifier ?? null;
}

export async function selfEthAddress(): Promise<string | null> {
  const client = await xmtpClient();
  return client.accountIdentifier?.identifier ?? null;
}

export function getOrCreateXmtpClient(env: XmtpEnv = 'production'): Promise<WebXmtpClient> {
  return getOrCreateCachedClient(async () => {
    const account = await getActiveAccount();
    if (!account) throw new NoAccountError();
    return buildClientForAccount(account, env);
  });
}

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
  await secureStorage.delete(installationKeyFor(id)).catch(() => undefined);
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

export async function resetActiveXmtpStore(): Promise<void> {
  const rec = await getActiveAccount();
  if (!rec) return;
  disposeCachedClient();
  deleteDbFiles(rec.dbDir);
  await deleteDbKey(rec.id);
  await forgetSavedClient(rec.id);
}

export interface XmtpInstallation {
  id: string;
  createdAt: number | undefined;
  current: boolean;
}

export async function listXmtpInstallations(): Promise<XmtpInstallation[]> {
  const client = await xmtpClient();
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
  const client = await xmtpClient();
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

export { getLastReadNs, setLastReadNs, getMarkedUnread, setMarkedUnreadFlag, markConvUnreadSynced } from './xmtp.unread';

export async function markConvReadSynced(convId: string): Promise<void> {
  await markConvReadLocally(convId);
  try {
    const conv = await convOfLine(lineOfConv(convId));
    if (conv && (await conv.consentState()) !== ConsentState.Allowed) {
      await conv.updateConsentState(ConsentState.Allowed);
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
  const client = await xmtpClient();
  const conv = await client.conversations.getConversationById(convId).catch(() => undefined);
  return conv ?? null;
}

export async function xmtpClient(): ReturnType<typeof getOrCreateXmtpClient> {
  return getCachedXmtpClient() ?? await getOrCreateXmtpClient('production');
}
