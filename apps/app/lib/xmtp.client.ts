/** @file Local XMTP client lifecycle (Client.create on first launch persisting keys in native sqlite, Client.build later) with the shared cached-client bridge; key material never crosses the JS bridge, extracted from lib/xmtp.ts. */

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

/** Thrown by getOrCreateXmtpClient when the registry is empty (onboarding incomplete); we must not auto-mint an account here since a boot-time caller doing so persisted a throwaway account that skipped onboarding next launch. */
export class NoAccountError extends Error {
  /** Build the no-account error with its fixed message and name. */
  constructor() { super('No account — onboarding not completed yet.'); this.name = 'NoAccountError'; }
}

/** SecureStore keys must match `[A-Za-z0-9._-]+` — colons are rejected on Android, which surfaced as an `Invalid key provided to SecureStore` runtime crash on Less's device. */
const ENV_KEY = 'xmtp.env';

/** Lazily build the XMTP client (singleton, repeat calls share the instance), called from the app's root effect; the identity bootstraps from the local EOA in `lib/wallet.ts` so the same address signs XMTP registration and Snapshot profile updates. */
export async function getOrCreateXmtpClient(env: XmtpEnv = 'production'): Promise<Client> {
  const cached = getCachedXmtpClient();
  if (cached) return cached;
  /** Single-flight guard: many screens call getOrCreate on first paint, and N concurrent create/build calls on the same dbDirectory break the native SQLCipher store (can't open twice), so coalesce all callers onto one in-flight promise. */
  if (inFlightCreate) return inFlightCreate;
  inFlightCreate = (async () => {
    /** Resolve the active account, never minting one here (only onboarding or an explicit action creates accounts), so boot-time callers on a fresh install don't persist a throwaway account that skips onboarding; throw the recognisable error callers swallow. */
    const account = await getActiveAccount();
    if (!account) throw new NoAccountError();
    return buildClientForAccount(account, env);
  })();
  try { return await inFlightCreate; } finally { inFlightCreate = null; }
}
/** The one in-flight client bootstrap, shared by all concurrent first-paint callers so we never open the same on-disk SQLCipher store twice at once. */
let inFlightCreate: Promise<Client> | null = null;

/** (Re)build the XMTP client for an account: tries `Client.build` against its own db when an installation likely exists, races a 20s timeout (MLS replay can hang on a corrupt store), and falls back to a fresh `Client.create` + registration. */
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
        /** Auto-register this device's push token with the daemon for the now-active account. Fire-and-forget + debounced inside — never blocks boot. */
        void registerPushWithDaemon(built);
        return built;
      }
      /** Build timed out — fall through to create() with a fresh registration. */
    } catch (e) {
      /** A corrupt/key-mismatched store makes `Client.build` throw, and create() would re-open the same dirty store and fail identically, so wipe this account's store + key first then rebuild opts against the clean dir + fresh key (non-corruption failures fall through unchanged). */
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

/** Switch the active account: drop the cached client and rebuild against the target account's db. */
export async function switchToAccount(id: string, env: XmtpEnv = 'production'): Promise<Client> {
  const list = await loadAccounts();
  const rec = list.find(a => a.id === id);
  if (!rec) throw new Error('Account not found.');
  resetClientScopedState();
  /** Switch the WALLET first: the local EOA / Railgun is decoupled from XMTP, so the new account must be usable for signing even if its XMTP inbox fails to build below (clean-reinstall key mismatch, native create hang). */
  await setActiveAccountId(id);
  try {
    const client = await buildClientForAccount(rec, env);
    /** Bump the account epoch so every screen holding per-account XMTP state re-inits against the new inbox without a hard app reload. */
    bumpAccountEpoch();
    return client;
  } catch (e) {
    /** XMTP build/create failed but the wallet is already switched. Bump the epoch so HomeScreen re-inits and its init-catch surfaces the recoverable HomeError instead of a dead spinner. Re-throw so the caller can also toast. */
    bumpAccountEpoch();
    throw e;
  }
}

/** Delete a single account: registry entry + key (lib/accounts) + its on-disk XMTP store. Drops the cached client so the next getOrCreate rebuilds against whatever account is active afterwards. */
export async function deleteAccount(id: string): Promise<void> {
  const list = await loadAccounts();
  const rec = list.find(a => a.id === id);
  await removeAccount(id);
  if (rec) deleteDbFiles(rec.dbDir);
  await deleteDbKey(id);
  resetClientScopedState();
}

/** Full wipe: drop the cached client, every account's on-disk XMTP store (plus the legacy `xmtp/` dir), the shared db key, and the account registry. */
export async function resetXmtpClient(): Promise<void> {
  resetClientScopedState();
  await SecureStore.deleteItemAsync(ENV_KEY).catch(() => undefined);
  const removed = await clearAllAccounts();
  /** Drop every removed account's per-account db key + the legacy global key. */
  await Promise.all(removed.map(a => deleteDbKey(a.id)));
  await deleteLegacyDbKey();
  const dirs = new Set<string>(['xmtp', ...removed.map(a => a.dbDir)]);
  for (const name of dirs) deleteDbFiles(name);
}

/** One XMTP installation (device session) of the active inbox, flattened for the settings UI. `current` marks THIS device — revoking it logs this device out. */
export interface XmtpInstallation {
  id: string;
  createdAt: number | undefined;
  current: boolean;
}

/** List the active inbox's installations (devices/sessions), newest first, with the current device flagged. Reads the live inbox state from the network so a device revoked elsewhere disappears. Throws if no client / no account. */
export async function listXmtpInstallations(): Promise<XmtpInstallation[]> {
  const client = getCachedXmtpClient() ?? await getOrCreateXmtpClient('production');
  const state = await client.inboxState(true);
  const current = client.installationId;
  return state.installations
    .map(i => ({ id: i.id, createdAt: i.createdAt, current: i.id === current }))
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
}

/** Revoke one installation of the active inbox, signing via the active account's signer (the same keyring-backed path as install-limit recovery, no key crossing the JS bridge); revoking the current installation logs this device out. */
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

/** Per-conv "last read at" timestamp (XMTP `sentNs` units) in SecureStore. Drives the Channels unread count + marks messages read on open. */
const LAST_READ_PREFIX = 'unread.lastRead.';
/** Read the stored "last read at" timestamp (sentNs) for a conversation, or 0 if unset. */
export async function getLastReadNs(convId: string): Promise<number> {
  const raw = await getSecure(LAST_READ_PREFIX + convId);
  if (!raw) return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}
/** Persist the "last read at" timestamp (sentNs) for a conversation in SecureStore. */
export async function setLastReadNs(convId: string, ns: number): Promise<void> {
  await setSecure(LAST_READ_PREFIX + convId, String(ns));
}

/** Mark read: bump local `lastReadNs` past every message so the badge clears. */
export async function markConvReadSynced(convId: string): Promise<void> {
  await setLastReadNs(convId, Date.now() * 1_000_000);
}

/** Mark unread: rewind `lastReadNs` to 0 so the badge surfaces on next recount. */
export async function markConvUnreadSynced(convId: string): Promise<void> {
  await setLastReadNs(convId, 0);
}

/** Pull synced preference updates from the network into the local DB. Call on app foreground so preference changes made on another device land here. */
export async function syncPreferences(): Promise<void> {
  try {
    const client = getCachedXmtpClient();
    await (client as unknown as { preferences?: { sync?: () => Promise<unknown> } })?.preferences?.sync?.();
  } catch { /* best-effort */ }
}

/** Look up an XMTP conversation by metro line URI. Returns null if the cached client isn't ready or the conversation isn't on this installation. */
export async function convOfLine(line: string): Promise<Conversation | null> {
  const convId = convIdOfLine(line);
  if (!convId) return null;
  const client = getCachedXmtpClient() ?? await getOrCreateXmtpClient('production');
  /** `findConversation` wants a branded `ConversationId` (structural tag over a string) — cast through unknown. */
  const conv = await client.conversations.findConversation(convId as unknown as Parameters<typeof client.conversations.findConversation>[0])
    .catch(() => null);
  return conv ?? null;
}
