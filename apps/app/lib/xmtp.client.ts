/** Local XMTP client lifecycle for the mobile app.
 *
 *  First launch:
 *    `Client.createRandom({env})` → native SDK generates a wallet, persists keys in its
 *    internal sqlite at `dbDirectory`. We capture the resulting address and stash it in
 *    expo-secure-store so subsequent launches know which inbox to rebuild.
 *
 *  Subsequent launches:
 *    `Client.build(address, {env, dbDirectory})` → reuses the on-disk wallet.
 *
 *  Key material never crosses the JS bridge — the SDK keeps it native side, backed by the
 *  device keystore on Android and the secure enclave on iOS.
 *
 *  Extracted from lib/xmtp.ts (phase-2 lint split); re-exported from there. */

import * as SecureStore from 'expo-secure-store';
import { Client, PublicIdentity, type Conversation } from '@xmtp/react-native-sdk';
import {
  getActiveAccount, addGeneratedAccount,
  loadAccounts, setActiveAccountId, markRegistered, removeAccount, clearAllAccounts,
  type AccountRecord,
} from './accounts';
import { registerPushWithDaemon } from './push';
import { getSecure, setSecure } from './cache';
import { bumpAccountEpoch } from './accountEpoch';
import { XMTP_CODECS, signerForRecord } from './xmtp.codecs';
import {
  getCachedXmtpClient, setCachedXmtpClient, resetClientScopedState,
} from './xmtp.state';
import { type XmtpEnv, convIdOfLine } from './xmtp.types';
import { loadOrCreateDbKey, deleteDbKey, dbDirObj, ensureDbDir } from './xmtp.dbkey';

export { getCachedXmtpClient } from './xmtp.state';

/** SecureStore keys must match `[A-Za-z0-9._-]+` — colons are rejected on Android, which
 *  surfaced as an `Invalid key provided to SecureStore` runtime crash on Less's device. */
const ENV_KEY = 'xmtp.env';

/** Lazily build the XMTP client. Returns a singleton — repeat calls share the instance.
 *  Called from the app's root effect on startup. The XMTP identity is bootstrapped
 *  from the local EOA in `lib/wallet.ts`, so the same address signs both XMTP
 *  registration and Snapshot profile updates. */
export async function getOrCreateXmtpClient(env: XmtpEnv = 'production'): Promise<Client> {
  const cached = getCachedXmtpClient();
  if (cached) return cached;
  /** Resolve the active account, minting + activating a generated one on the
   *  very first launch (or after a full reset). */
  const account = (await getActiveAccount()) ?? (await addGeneratedAccount());
  return buildClientForAccount(account, env);
}

/** (Re)build the XMTP client for a specific account. Tries `Client.build`
 *  against that account's own db when we believe an installation exists, races
 *  a 20s timeout (MLS replay can hang on a corrupted store), and falls back to
 *  a fresh `Client.create` + installation registration. */
async function buildClientForAccount(rec: AccountRecord, env: XmtpEnv): Promise<Client> {
  const dbDirectory = await ensureDbDir(rec.dbDir);
  const dbEncryptionKey = await loadOrCreateDbKey();
  const opts = { env, dbDirectory, dbEncryptionKey, codecs: XMTP_CODECS };
  if (rec.registered) {
    try {
      const built = await Promise.race<Client | null>([
        Client.build(new PublicIdentity(rec.address, 'ETHEREUM'), opts),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 20_000)),
      ]);
      if (built) {
        setCachedXmtpClient(built);
        await setActiveAccountId(rec.id);
        await SecureStore.setItemAsync(ENV_KEY, env);
        /** Auto-register this device's push token with the daemon for the now-
         *  active account (background push for daemon-run inboxes). Fire-and-
         *  forget + debounced inside registerPushWithDaemon — never blocks boot. */
        void registerPushWithDaemon(built);
        return built;
      }
      /** Build timed out — fall through to create() with a fresh registration. */
    } catch { /* fall through to create() if rebuild failed */ }
  }
  /** XMTP registers a new installation by asking the account to sign its
   *  handshake challenge — silent for local keys, a one-time wallet prompt
   *  for WalletConnect. */
  const signer = await signerForRecord(rec);
  const created = await Client.create(signer, opts);
  setCachedXmtpClient(created);
  await markRegistered(rec.id);
  await setActiveAccountId(rec.id);
  await SecureStore.setItemAsync(ENV_KEY, env);
  /** Same auto-registration on the fresh-installation path. */
  void registerPushWithDaemon(created);
  return created;
}

/** Switch the active account: drop the cached client and rebuild against the
 *  target account's db. Callers typically reload the app afterwards so every
 *  screen re-inits against the new inbox. */
export async function switchToAccount(id: string, env: XmtpEnv = 'production'): Promise<Client> {
  const list = await loadAccounts();
  const rec = list.find(a => a.id === id);
  if (!rec) throw new Error('Account not found.');
  resetClientScopedState();
  await setActiveAccountId(id);
  const client = await buildClientForAccount(rec, env);
  /** Bump the account epoch so every screen holding per-account XMTP state
   *  (channels list, open conversation) re-inits against the new inbox without a
   *  hard app reload. Callers used to DevSettings.reload() here. */
  bumpAccountEpoch();
  return client;
}

/** Delete a single account: registry entry + key (lib/accounts) + its on-disk
 *  XMTP store. Drops the cached client so the next getOrCreate rebuilds against
 *  whatever account is active afterwards. */
export async function deleteAccount(id: string): Promise<void> {
  const list = await loadAccounts();
  const rec = list.find(a => a.id === id);
  await removeAccount(id);
  if (rec) {
    const dir = dbDirObj(rec.dbDir);
    if (dir.exists) { try { dir.delete(); } catch { /* best-effort */ } }
  }
  resetClientScopedState();
}

/** Full wipe: drop the cached client, every account's on-disk XMTP store (plus
 *  the legacy `xmtp/` dir), the shared db key, and the whole account registry.
 *  Next call to `getOrCreateXmtpClient` mints a fresh wallet + inbox. */
export async function resetXmtpClient(): Promise<void> {
  resetClientScopedState();
  await SecureStore.deleteItemAsync(ENV_KEY).catch(() => undefined);
  await deleteDbKey();
  const removed = await clearAllAccounts();
  const dirs = new Set<string>(['xmtp', ...removed.map(a => a.dbDir)]);
  for (const name of dirs) {
    const dir = dbDirObj(name);
    if (dir.exists) { try { dir.delete(); } catch { /* best-effort */ } }
  }
}

/** Per-conv "last read at" timestamp (XMTP `sentNs` units) persisted in
 *  SecureStore. Used by the Channels list to compute an unread count and
 *  by the conversation view to mark messages as read on open. */
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

/** Mark a conversation read: bump the local `lastReadNs` past every message so
 *  the per-device unread count clears. No consent write. */
export async function markConvReadSynced(convId: string): Promise<void> {
  await setLastReadNs(convId, Date.now() * 1_000_000);
}

/** Mark a conversation unread: rewind `lastReadNs` to 0 so the badge surfaces
 *  again on the next recount. No consent write. */
export async function markConvUnreadSynced(convId: string): Promise<void> {
  await setLastReadNs(convId, 0);
}

/** Pull synced preference updates from the network into the local DB. Call on
 *  app foreground so preference changes made on another device land here. */
export async function syncPreferences(): Promise<void> {
  try {
    const client = getCachedXmtpClient();
    await (client as unknown as { preferences?: { sync?: () => Promise<unknown> } })?.preferences?.sync?.();
  } catch { /* best-effort */ }
}

/** Look up an XMTP conversation by metro line URI. Returns null if the cached client
 *  isn't ready or the conversation isn't on this installation. */
export async function convOfLine(line: string): Promise<Conversation | null> {
  const convId = convIdOfLine(line);
  if (!convId) return null;
  const client = getCachedXmtpClient() ?? await getOrCreateXmtpClient('production');
  /** `findConversation` expects a branded `ConversationId`. The brand is a structural
   *  tag — the underlying value is still a string, so cast through unknown. */
  const conv = await client.conversations.findConversation(convId as unknown as Parameters<typeof client.conversations.findConversation>[0])
    .catch(() => null);
  return conv ?? null;
}
