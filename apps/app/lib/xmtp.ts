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
 *  device keystore on Android and the secure enclave on iOS. */

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { Directory, File, Paths } from 'expo-file-system';
import {
  Client, PublicIdentity,
  ReactionCodec, ReplyCodec, StaticAttachmentCodec, RemoteAttachmentCodec,
  MultiRemoteAttachmentCodec, GroupUpdatedCodec,
  type Conversation, type DecodedMessage, type ConversationVersion,
  type ReactionContent, type ReplyContent, type StaticAttachmentContent,
  type MultiRemoteAttachmentContent, type RemoteAttachmentInfo,
  type RemoteAttachmentMetadata, type EncryptedLocalAttachment,
  type Signer,
} from '@xmtp/react-native-sdk';
import type { PrivateKeyAccount } from 'viem/accounts';

/** Codecs the local XMTP client decodes inbound + uses to encode outbound. Without these
 *  the RN SDK's `msg.content()` throws on reaction/reply/attachment payloads and we fall
 *  back to "[<typeId> payload]" placeholder text — that's why Less saw "[reaction payload]"
 *  instead of "[react 👍]" on his own outbound bubbles. GroupUpdatedCodec is required for
 *  membership/rename system messages to decode at all. */
const XMTP_CODECS = [
  new ReactionCodec(),
  new ReplyCodec(),
  new StaticAttachmentCodec(),
  new RemoteAttachmentCodec(),
  /** MultiRemoteAttachmentCodec lets one message carry several encrypted-remote
   *  attachments (`xmtp.org/multiRemoteStaticAttachment`). Without it registered,
   *  `msg.content()` throws on inbound multi-attachment payloads and we'd fall
   *  back to the "[…payload]" placeholder; on outbound it's needed so
   *  `conv.send({ multiRemoteAttachment })` encodes. Pure JS registration — the
   *  native module (already in @xmtp/react-native-sdk 5.7.0) supplies the
   *  encrypt/decrypt primitives, so no new native dep / dev-client rebuild. */
  new MultiRemoteAttachmentCodec(),
  new GroupUpdatedCodec(),
];
import type { HistoryEntry } from './types';
import {
  getActiveAccount, addGeneratedAccount, getViemAccount,
  loadAccounts, setActiveAccountId, markRegistered, removeAccount, clearAllAccounts,
  type AccountRecord,
} from './accounts';
import { humanizeGroupUpdated, type GroupUpdatedContent } from '@metro-labs/client/xmtp/humanize';
import { getWcSign } from './wcSigner';
import { registerPushWithDaemon, isMetroControlBody } from './push';
import { MemoryStore, getSecure, setSecure } from './cache';
import { bumpAccountEpoch, useAccountEpoch } from './accountEpoch';

/** Build the XMTP-RN `Signer` adapter for a viem `PrivateKeyAccount`.
 *  Shape pulled from `node_modules/@xmtp/react-native-sdk/src/lib/Signer.ts`:
 *  `getIdentifier / getChainId / getBlockNumber / signerType / signMessage`.
 *  `signMessage` resolves with `{ signature: hexString }` — passing a
 *  viem WalletClient instead surfaces as "Cannot read property 'raw' of
 *  undefined" inside the native registration handler. */
function signerForAccount(account: PrivateKeyAccount): Signer {
  return {
    getIdentifier: async () => new PublicIdentity(account.address, 'ETHEREUM'),
    getChainId: () => 1,
    getBlockNumber: () => undefined,
    signerType: () => 'EOA',
    signMessage: async (message: string) => {
      const signature = await account.signMessage({ message });
      return { signature };
    },
  };
}

/** Build the XMTP Signer for an account record. Local accounts (generated /
 *  imported) sign silently with their viem key; WalletConnect accounts would
 *  delegate to the connected wallet — only ever needed once, at installation
 *  registration (Client.create). Reads + sends afterwards use the on-device
 *  installation key, so a registered account never re-prompts the wallet. */
async function signerForRecord(rec: AccountRecord): Promise<Signer> {
  if (rec.type === 'walletconnect') {
    const wcSign = getWcSign();
    if (!wcSign) throw new Error('Reconnect your wallet to finish setting up this account.');
    return {
      getIdentifier: async () => new PublicIdentity(rec.address, 'ETHEREUM'),
      getChainId: () => 1,
      getBlockNumber: () => undefined,
      signerType: () => 'EOA',
      signMessage: async (message: string) => {
        /** Routes to the connected wallet via WalletConnect (personal_sign).
         *  Only invoked once — when registering this account's XMTP installation. */
        const signature = await wcSign(message);
        return { signature };
      },
    };
  }
  const acct = await getViemAccount(rec.id);
  if (!acct) throw new Error('No signing key for this account.');
  return signerForAccount(acct);
}

export type XmtpEnv = 'production' | 'dev' | 'local';

/** SecureStore keys must match `[A-Za-z0-9._-]+` — colons are rejected on Android, which
 *  surfaced as an `Invalid key provided to SecureStore` runtime crash on Less's device. */
const ENV_KEY = 'xmtp.env';
const DB_ENCRYPTION_KEY = 'xmtp.dbEncryptionKey';

/** XMTP requires a 32-byte key it uses to AES-encrypt the on-device sqlite store. We mint
 *  one on first launch and persist it in expo-secure-store (secure enclave on iOS, Android
 *  keystore on Android). Without this the DB is unreadable across launches. */
async function loadOrCreateDbKey(): Promise<Uint8Array> {
  const existing = await SecureStore.getItemAsync(DB_ENCRYPTION_KEY).catch(() => null);
  if (existing) {
    const bin = atob(existing);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  const fresh = new Uint8Array(32);
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(fresh);
  } else {
    /** Fallback — Math.random is non-cryptographic but the alternative is failing to boot.
     *  In practice RN provides crypto.getRandomValues, so we never hit this. */
    for (let i = 0; i < fresh.length; i++) fresh[i] = Math.floor(Math.random() * 256);
  }
  let b64 = '';
  for (const byte of fresh) b64 += String.fromCharCode(byte);
  await SecureStore.setItemAsync(DB_ENCRYPTION_KEY, btoa(b64));
  return fresh;
}

/** XMTP needs a writable directory for its sqlite + key store. Document directory is
 *  app-private + persisted across restarts. */
function dbDirObj(name: string): Directory { return new Directory(Paths.document, name); }

async function ensureDbDir(name: string): Promise<string> {
  const dir = dbDirObj(name);
  if (!dir.exists) dir.create({ intermediates: true });
  /** XMTP wants a filesystem path (`/data/user/0/...`), not a URI (`file:///data/user/0/...`).
   *  expo-file-system's `.uri` includes the scheme; strip it. Also drop any trailing slash —
   *  the SDK appends its own file names. */
  return dir.uri.replace(/^file:\/+/, '/').replace(/\/$/, '');
}

/** Lazily build the XMTP client. Returns a singleton — repeat calls share the instance.
 *  Called from the app's root effect on startup. The XMTP identity is bootstrapped
 *  from the local EOA in `lib/wallet.ts`, so the same address signs both XMTP
 *  registration and Snapshot profile updates. */
let cachedClient: Client | null = null;
export async function getOrCreateXmtpClient(env: XmtpEnv = 'production'): Promise<Client> {
  if (cachedClient) return cachedClient;
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
        cachedClient = built;
        await setActiveAccountId(rec.id);
        await SecureStore.setItemAsync(ENV_KEY, env);
        /** Auto-register this device's push token with the daemon for the now-
         *  active account (background push for daemon-run inboxes). Fire-and-
         *  forget + debounced inside registerPushWithDaemon — never blocks boot. */
        void registerPushWithDaemon(built);
        return cachedClient;
      }
      /** Build timed out — fall through to create() with a fresh registration. */
    } catch { /* fall through to create() if rebuild failed */ }
  }
  /** XMTP registers a new installation by asking the account to sign its
   *  handshake challenge — silent for local keys, a one-time wallet prompt
   *  for WalletConnect. */
  const signer = await signerForRecord(rec);
  cachedClient = await Client.create(signer, opts);
  await markRegistered(rec.id);
  await setActiveAccountId(rec.id);
  await SecureStore.setItemAsync(ENV_KEY, env);
  /** Same auto-registration on the fresh-installation path. */
  void registerPushWithDaemon(cachedClient);
  return cachedClient;
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

/** Drop all client-scoped in-memory state on an account change: the cached
 *  client, the single global message stream + its backstops, and every session
 *  cache that's keyed to the previous inbox (per-conv feeds, inbox→eth). The
 *  persisted channels-list cache is cleared separately by the channels screen
 *  (clearCachedRows) since it lives in a different module to avoid an import
 *  cycle. */
function resetClientScopedState(): void {
  cachedClient = null;
  teardownGlobalStream();
  activeFeedLines.clear();
  feedCache.clear();
  inboxEthCache.clear();
}

export function getCachedXmtpClient(): Client | null { return cachedClient; }

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
  await SecureStore.deleteItemAsync(DB_ENCRYPTION_KEY).catch(() => undefined);
  const removed = await clearAllAccounts();
  const dirs = new Set<string>(['xmtp', ...removed.map(a => a.dbDir)]);
  for (const name of dirs) {
    const dir = dbDirObj(name);
    if (dir.exists) { try { dir.delete(); } catch { /* best-effort */ } }
  }
}

/** Format a metro-style line URI for an XMTP conversation. Mirrors the daemon train. */
export function lineOfConv(convId: string): string { return `metro://xmtp/${convId}`; }

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

/** Cross-device read/unread marker — synced across the inbox's installations via
 *  XMTP's per-conversation consent state.
 *
 *  XMTP V3's `client.preferences` does NOT expose an arbitrary synced key/value
 *  store; the only writable, per-conversation primitive that auto-syncs across a
 *  user's installations is conversation *consent* (`allowed | denied | unknown`,
 *  streamed via `streamConsent`, pulled via `preferences.sync()`). We repurpose
 *  the `allowed`↔`unknown` axis as a synced read flag — never `denied`, which
 *  would hide/block the conversation:
 *    - `allowed`  → read
 *    - `unknown`  → unread (also the default for a brand-new inbound conv, which
 *                   already shows a badge from its timestamp count, so the
 *                   semantics line up)
 *  The numeric unread *count* stays per-device (lastReadNs); the binary
 *  read/unread state is what propagates cross-device. */
export type XmtpConsent = 'allowed' | 'denied' | 'unknown';

/** Read a conversation's synced consent state. 'unknown' on any failure so a
 *  fresh/unsynced conv reads as not-explicitly-read. */
export async function getConvConsent(convId: string): Promise<XmtpConsent> {
  try {
    const conv = await convOfLine(lineOfConv(convId));
    if (!conv) return 'unknown';
    return (await conv.consentState()) as XmtpConsent;
  } catch { return 'unknown'; }
}

/** Mark a conversation read across devices: consent → 'allowed' (synced) and
 *  bump the local lastReadNs so the per-device count clears too. */
export async function markConvReadSynced(convId: string): Promise<void> {
  await setLastReadNs(convId, Date.now() * 1_000_000);
  try {
    const conv = await convOfLine(lineOfConv(convId));
    if (conv && (await conv.consentState()) !== 'allowed') {
      await conv.updateConsent('allowed');
    }
  } catch { /* best-effort — local lastReadNs still cleared the badge */ }
}

/** Mark a conversation unread across devices: consent → 'unknown' (synced) and
 *  rewind the local lastReadNs so this device shows the badge immediately. */
export async function markConvUnreadSynced(convId: string): Promise<void> {
  /** Rewind just before the latest message so the timestamp count surfaces
   *  ≥1 unread here without depending on the consent stream round-trip. */
  await setLastReadNs(convId, 0);
  try {
    const conv = await convOfLine(lineOfConv(convId));
    if (conv && (await conv.consentState()) !== 'unknown') {
      await conv.updateConsent('unknown');
    }
  } catch { /* best-effort */ }
}

/** Pull synced preference/consent updates from the network into the local DB.
 *  Call on app foreground so consent changes made on another device land here. */
export async function syncPreferences(): Promise<void> {
  try {
    const client = getCachedXmtpClient();
    await (client as unknown as { preferences?: { sync?: () => Promise<unknown> } })?.preferences?.sync?.();
  } catch { /* best-effort */ }
}

/** Subscribe to cross-device consent changes. Fires `(convId, state)` whenever a
 *  conversation's consent flips on any of the inbox's installations. Returns an
 *  unsubscribe fn. Used by the Channels list to reconcile read/unread live. */
export function streamConvConsent(
  onChange: (convId: string, state: XmtpConsent) => void,
): () => void {
  const client = getCachedXmtpClient();
  const prefs = (client as unknown as {
    preferences?: {
      streamConsent?: (
        cb: (c: { value: string; entryType: string; state: XmtpConsent }) => Promise<void>,
      ) => Promise<void>;
      cancelStreamConsent?: () => void;
    };
  })?.preferences;
  if (!prefs?.streamConsent) return () => undefined;
  void prefs.streamConsent(async (c) => {
    /** Only conversation-scoped consent records carry an unread flag. */
    if (c.entryType === 'conversation_id') onChange(c.value, c.state);
  }).catch(() => undefined);
  return () => { try { prefs.cancelStreamConsent?.(); } catch { /* ignore */ } };
}

/** Pretty-print a wallet address as `0x1234…abcd`. */
export function shortAddress(addr: string): string {
  if (!addr) return '';
  return addr.length > 10 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
}

/** inbox id → ETH address cache. An inbox's ETH identity is stable, so once
 *  resolved we never hit the identity API for it again. This is the key to
 *  staying under XMTP's read rate limit: channel re-summarizes (30s poll,
 *  per-message stream, AppState resume, pull-to-refresh) reuse cached identities
 *  instead of calling GetIdentityUpdates per member on every pass. */
const inboxEthCache = new MemoryStore<string, string>();

/** Batch-resolve inbox ids → ETH address across MANY rows in ONE network call.
 *  Collect every uncached id, fire a single `inboxStates(true, [...])`, prime the
 *  cache, then per-row work can call `resolveInboxEth` (cache hit, zero reads).
 *  Kills the N+1 where each channel row resolved its members serially. Exported
 *  so the channels list can pre-warm the cache before summarising rows. */
export async function primeInboxEthCache(
  client: Awaited<ReturnType<typeof getOrCreateXmtpClient>>,
  ids: string[],
): Promise<void> {
  const missing = [...new Set(ids)].filter(id => id && !inboxEthCache.get(id));
  if (missing.length === 0) return;
  try {
    const states = await client.inboxStates(
      true,
      missing as Parameters<typeof client.inboxStates>[1],
    );
    for (let i = 0; i < missing.length; i++) {
      const eth = states[i]?.identities.find(it => it.kind === 'ETHEREUM');
      if (eth?.identifier) inboxEthCache.set(missing[i]!, eth.identifier);
    }
  } catch { /* best-effort — per-row resolveInboxEth still falls back */ }
}

/** Resolve inbox ids → ETH address, cache-first. Only ids not already cached
 *  hit the network (`inboxStates(true)`); cached ids cost zero reads. */
async function resolveInboxEth(
  client: Awaited<ReturnType<typeof getOrCreateXmtpClient>>,
  ids: string[],
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const missing: string[] = [];
  for (const id of ids) {
    const cached = inboxEthCache.get(id);
    if (cached) out[id] = cached;
    else missing.push(id);
  }
  if (missing.length > 0) {
    const states = await client.inboxStates(
      true,
      missing as Parameters<typeof client.inboxStates>[1],
    );
    for (let i = 0; i < missing.length; i++) {
      const eth = states[i]?.identities.find(it => it.kind === 'ETHEREUM');
      if (eth?.identifier) {
        out[missing[i]!] = eth.identifier;
        inboxEthCache.set(missing[i]!, eth.identifier);
      }
    }
  }
  return out;
}

/** Resolve the peer's Ethereum address for a DM conversation. Returns null for
 *  groups or when the lookup fails. Cached after the first resolve. */
export async function peerEthAddressOfDm(conv: Conversation): Promise<string | null> {
  /** `version` is 'DM' | 'GROUP'; only DMs have a single peer. */
  if ((conv as unknown as { version?: string }).version !== 'DM') return null;
  const dm = conv as unknown as { peerInboxId: () => Promise<string> };
  try {
    const inboxId = await dm.peerInboxId();
    const client = getCachedXmtpClient() ?? await getOrCreateXmtpClient('production');
    const map = await resolveInboxEth(client, [inboxId]);
    return map[inboxId] ?? null;
  } catch { return null; }
}

/** stamp.fyi avatar URL for an Ethereum address. Matches the host sx-monorepo uses
 *  (`apps/ui/src/helpers/stamp.ts`). The CDN returns a 200 with a generic identicon
 *  when no custom avatar is set, so callers can render this URL directly without
 *  needing a network-error fallback.
 *
 *  `cacheBust` is appended verbatim as `&cb=…` — pass a value that changes when
 *  the underlying avatar changes (e.g. the last few chars of the IPFS CID
 *  stored in profile.avatar) so the device + stamp CDN refetch instead of
 *  serving the previous image. */
export function stampBoxAvatarUrl(address: string, size = 120, cacheBust?: string): string {
  const base = `https://stamp.fyi/avatar/eth:${address.toLowerCase()}?s=${size}`;
  return cacheBust ? `${base}&cb=${encodeURIComponent(cacheBust)}` : base;
}

/** Find or create a DM with a peer by Ethereum address. Returns the conv id
 *  ready to push into `/xmtp/[convId]`. Used from the per-user profile page'​s
 *  "Open chat" button. */
export async function openDmWithAddress(address: string): Promise<string> {
  const client = await getOrCreateXmtpClient('production');
  const dm = await client.conversations.findOrCreateDmWithIdentity(
    new PublicIdentity(address, 'ETHEREUM'),
  );
  return dm.id;
}

/** Resolve every member of a conversation as a `{inboxId → ethAddress}` map,
 *  INCLUDING the local user. Used by the conversation view to look up the
 *  sender of each message and render their stamp.fyi avatar. */
export async function memberInboxToAddressMap(conv: Conversation): Promise<Record<string, string>> {
  try {
    const client = getCachedXmtpClient() ?? await getOrCreateXmtpClient('production');
    const members = await (conv as unknown as {
      members: () => Promise<{ inboxId: string }[]>;
    }).members();
    const ids = members.map(m => m.inboxId);
    return await resolveInboxEth(client, ids);
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') console.warn('memberInboxToAddressMap failed', (err as Error).message);
    return {};
  }
}

/** Resolve the Ethereum addresses of every member of a group conversation, excluding the
 *  local user's own inbox. Used by the Channels list to render a multi-avatar stack for
 *  group rows. Returns [] for DMs (use `peerEthAddressOfDm` for those) or when the
 *  members lookup fails. */
export async function groupMemberEthAddresses(conv: Conversation): Promise<string[]> {
  if ((conv as unknown as { version?: string }).version !== 'GROUP') return [];
  try {
    const client = getCachedXmtpClient() ?? await getOrCreateXmtpClient('production');
    const members = await (conv as unknown as {
      members: () => Promise<{ inboxId: string }[]>;
    }).members();
    const otherIds = members
      .map(m => m.inboxId)
      .filter(id => id !== client.inboxId);
    const map = await resolveInboxEth(client, otherIds);
    return otherIds.map(id => map[id]).filter((a): a is string => !!a);
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') console.warn('groupMemberEthAddresses failed', (err as Error).message);
    return [];
  }
}

/** Leave a group conversation. The XMTP RN SDK (5.7) exposes `group.leaveGroup()`
 *  natively — it removes the local inbox from the group's member list (a real
 *  leave, not a local hide). Falls back to denying consent (local hide) when the
 *  conversation predates the method or `leaveGroup` throws, so the row still
 *  disappears from the user's list either way. Returns `'left'` for a true leave,
 *  `'hidden'` when it could only deny consent. */
export async function leaveGroupConv(line: string): Promise<'left' | 'hidden'> {
  const conv = await convOfLine(line);
  if (!conv) throw new Error('Conversation not found');
  const group = conv as unknown as {
    leaveGroup?: () => Promise<void>;
    updateConsent?: (state: XmtpConsent) => Promise<void>;
  };
  if (group.leaveGroup) {
    try {
      await group.leaveGroup();
      /** Also deny consent so the conversation drops out of the local list
       *  immediately, before the member-removal commit syncs back. */
      await group.updateConsent?.('denied').catch(() => undefined);
      return 'left';
    } catch {
      /* fall through to consent-deny hide */
    }
  }
  if (!group.updateConsent) throw new Error('Not a group conversation');
  await group.updateConsent('denied');
  return 'hidden';
}

export type { ConversationVersion };

/** URI prefix used for inbound XMTP "from" addresses. Mirrors the daemon-side train
 *  (`packages/metro/examples/xmtp.ts`) so the rest of the app can rely on a single
 *  convention. */
export const XMTP_USER_PREFIX = 'metro://xmtp/user/';

/** Extract the XMTP conversation id from a `metro://xmtp/<convId>` line URI.
 *  Returns null when the line doesn't match. */
export function convIdOfLine(line: string): string | null {
  const m = line.match(/^metro:\/\/xmtp\/([^/]+)$/);
  return m ? m[1] : null;
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

/** Convert a decoded XMTP message into the same `HistoryEntry` envelope used by the
 *  daemon-side event log + the existing `MessengerBubble` renderer. Mirrors the
 *  shape emitted by `packages/metro/examples/xmtp.ts` (the node-sdk train) so the UI
 *  layer doesn't have to care which transport an event came from. */
export function envelopeOfXmtpMessage(msg: DecodedMessage, line: string): HistoryEntry {
  const from = `${XMTP_USER_PREFIX}${msg.senderInboxId}`;
  /** `sentNs` is a JS number (nanoseconds). Divide to ms — ample precision for ts strings. */
  const ts = new Date(Math.floor(msg.sentNs / 1_000_000)).toISOString();
  const base: HistoryEntry = {
    id: msg.id,
    ts,
    station: 'xmtp',
    line,
    from,
    to: line,
    messageId: msg.id,
  };
  /** typeId looks like `xmtp.org/text:1.0` — strip authority + version for the switch. */
  const typeId = msg.contentTypeId.split('/').pop()?.split(':')[0] ?? 'unknown';
  let decoded: unknown;
  try { decoded = msg.content(); }
  catch { return { ...base, text: `[${typeId} payload]`, payload: { contentType: typeId } }; }

  if (typeof decoded === 'string') {
    return { ...base, text: decoded, payload: { contentType: typeId } };
  }
  if (typeId === 'reaction') {
    const r = decoded as ReactionContent;
    const removed = r.action === 'removed';
    return {
      ...base,
      text: `[react ${r.content}${removed ? ' (removed)' : ''}]`,
      payload: { contentType: typeId, reactTo: r.reference, emoji: r.content, removed },
    };
  }
  if (typeId === 'reply') {
    const r = decoded as ReplyContent;
    /** Inner reply payload is a NativeMessageContent — promote text up to the bubble level
     *  when present, otherwise emit a fallback string so the bubble has something to show. */
    const innerText = r.content?.text;
    return {
      ...base,
      text: innerText ?? `[reply]`,
      replyTo: r.reference,
      payload: { contentType: typeId, replyTo: r.reference },
    };
  }
  if (typeId === 'group_updated' || typeId === 'groupUpdated') {
    const summary = humanizeGroupUpdated(decoded as GroupUpdatedContent);
    return { ...base, text: summary, payload: { contentType: typeId, system: true } };
  }
  if (typeId === 'attachment') {
    const a = decoded as StaticAttachmentContent;
    const kind = a.mimeType?.startsWith('image/') ? 'image'
      : a.mimeType?.startsWith('audio/') ? 'audio'
        : a.mimeType?.startsWith('video/') ? 'video' : 'file';
    return {
      ...base,
      text: `[${kind}: ${a.filename}]`,
      /** `data` arrives already base64-encoded over the RN bridge — see
       *  `ios/Wrappers/MessageWrapper.swift` (`base64EncodedString`). Pass straight through. */
      payload: { contentType: typeId, attachments: [{ kind, mime: a.mimeType, name: a.filename, dataB64: a.data }] },
    };
  }
  if (typeId === 'multiRemoteStaticAttachment' || typeId === 'multiRemoteAttachment') {
    /** One message carrying N encrypted-remote attachments. The bytes live on
     *  IPFS (ciphertext); each attachment is rendered as a `remote` placeholder
     *  and lazily downloaded + decrypted by the bubble (`resolveRemoteAttachment`).
     *  We surface the per-attachment metadata under `remote` so the renderer has
     *  everything it needs without re-decoding the message. The MIME type isn't in
     *  the metadata, so infer `kind` from the filename extension. */
    const m = decoded as MultiRemoteAttachmentContent;
    const attachments = (m.attachments ?? []).map((info, i) => {
      const name = info.filename ?? `attachment-${i + 1}`;
      const ext = name.split('.').pop()?.toLowerCase() ?? '';
      const kind = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'].includes(ext) ? 'image'
        : ['m4a', 'mp3', 'wav', 'aac', 'ogg'].includes(ext) ? 'audio'
          : ['mp4', 'mov', 'webm'].includes(ext) ? 'video' : 'file';
      return { kind, name, remote: info };
    });
    const summary = attachments.length === 1
      ? `[${attachments[0]!.kind}: ${attachments[0]!.name}]`
      : `[${attachments.length} attachments]`;
    return { ...base, text: summary, payload: { contentType: typeId, attachments } };
  }
  /** Unknown / unsupported codec — render fallback if the codec provided one. */
  return { ...base, text: msg.fallback ?? `[${typeId} payload]`, payload: { contentType: typeId } };
}

/** Send a plain-text XMTP message. Returns the message id. */
export async function xmtpSendText(line: string, text: string): Promise<string> {
  const conv = await convOfLine(line);
  if (!conv) throw new Error(`XMTP conversation not found: ${line}`);
  return await conv.send(text);
}

/** Send an XMTP reaction (action=added) or removal (action=removed) targeting an existing
 *  message id in the same conversation. */
export async function xmtpReact(
  line: string, messageId: string, emoji: string, action: 'added' | 'removed' = 'added',
): Promise<string> {
  const conv = await convOfLine(line);
  if (!conv) throw new Error(`XMTP conversation not found: ${line}`);
  const payload: ReactionContent = { reference: messageId, action, content: emoji, schema: 'unicode' };
  return await conv.send({ reaction: payload });
}

/** Send an XMTP reply (text body referencing an earlier message id). */
export async function xmtpReply(line: string, replyTo: string, text: string): Promise<string> {
  const conv = await convOfLine(line);
  if (!conv) throw new Error(`XMTP conversation not found: ${line}`);
  const payload: ReplyContent = { reference: replyTo, content: { text } };
  return await conv.send({ reply: payload });
}

/** Send an inline (static) XMTP attachment. `dataB64` is the raw bytes base64-encoded
 *  (matches the RN SDK bridge convention). Good for files < ~1 MB; larger payloads
 *  should use the remote-attachment flow (TODO). */
export async function xmtpSendAttachment(
  line: string, filename: string, mimeType: string, dataB64: string,
): Promise<string> {
  const conv = await convOfLine(line);
  if (!conv) throw new Error(`XMTP conversation not found: ${line}`);
  const payload: StaticAttachmentContent = { filename, mimeType, data: dataB64 };
  /** Use the typed `sendAttachment` helper (not the generic `send({attachment})`) so the
   *  native side runs the codec's full encode + size-validation path and surfaces real
   *  errors instead of silently dropping payloads that exceed libxmtp's per-message limit. */
   
  const c = conv as unknown as { sendAttachment?: (p: StaticAttachmentContent) => Promise<string> };
  if (typeof c.sendAttachment === 'function') return await c.sendAttachment(payload);
  return await conv.send({ attachment: payload });
}

/** Pineapple = Snapshot's IPFS pinning gateway. Reused from the avatar-upload
 *  path (`lib/profile.ts`); attachments are encrypted client-side before upload,
 *  so the public CID only ever exposes ciphertext. */
const PINEAPPLE_UPLOAD_URL = 'https://pineapple.fyi/upload';
/** Read gateway for fetching pinned content back. Mirrors `avatarRenderUrl`'s
 *  `ipfs://` resolution in `@metro-labs/client/profile/snapshot`. */
const IPFS_GATEWAY = 'https://snapshot.4everland.link/ipfs/';

/** A locally-staged attachment ready to bundle into a multi-remote message.
 *  `fileUri` may be `file://`, `content://` (Android gallery) or `blob:` (web) —
 *  `materializeFileUri` normalises it to the `file://` URI the native
 *  `encryptAttachment` requires. */
export interface LocalAttachmentInput { fileUri: string; mimeType: string; filename: string }

/** Extension → MIME fallback for the formats the composer can stage. Mirrors the
 *  composer's table; used as a last resort when a picker/recorder hands back an
 *  empty MIME so the native encoder never receives `''`. */
const EXT_MIME: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
  webp: 'image/webp', heic: 'image/heic', heif: 'image/heif', bmp: 'image/bmp',
  m4a: 'audio/m4a', mp3: 'audio/mpeg', wav: 'audio/wav', aac: 'audio/aac',
  ogg: 'audio/ogg', caf: 'audio/x-caf', mp4: 'video/mp4', mov: 'video/quicktime',
  webm: 'video/webm', pdf: 'application/pdf',
};

/** Resolve any staged source URI to a real on-disk `file://` URI.
 *
 *  `client.encryptAttachment` rejects anything that doesn't start with `file://`.
 *  A plain `file://` source is returned as-is. Other schemes (`content://` on
 *  Android, `blob:` / `data:` on web, bare paths) are streamed into the cache dir
 *  via `fetch().blob()` + `File.write` so the native side gets a path it can
 *  read. */
async function materializeFileUri(src: string): Promise<string> {
  if (src.startsWith('file://')) return src;
  /** Bare absolute path (no scheme) — just prefix it. */
  if (src.startsWith('/')) return `file://${src}`;
  const ext = src.split('?')[0]?.split('#')[0]?.split('.').pop()?.toLowerCase() ?? 'bin';
  const tmpName = `xmtp-send-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext.length <= 5 ? ext : 'bin'}`;
  const dest = new File(Paths.cache, tmpName);
  if (dest.exists) try { dest.delete(); } catch { /* overwrite below */ }
  const blob = await (await fetch(src)).blob();
  const buf = new Uint8Array(await blob.arrayBuffer());
  dest.create();
  dest.write(buf);
  return dest.uri.startsWith('file://') ? dest.uri : `file://${dest.uri.replace(/^file:\/+/, '/')}`;
}

/** Upload an encrypted attachment's ciphertext to IPFS and return the public
 *  HTTPS URL the recipient fetches from. Streams the file straight off disk via
 *  RN FormData (no base64 round-trip) — same shape as `uploadAvatar`. */
async function uploadEncryptedToIpfs(encryptedFileUri: string, filename: string): Promise<string> {
  const form = new FormData();
  form.append('file', { uri: encryptedFileUri, name: filename, type: 'application/octet-stream' } as unknown as Blob);
  const res = await fetch(PINEAPPLE_UPLOAD_URL, { method: 'POST', body: form });
  const json = await res.json().catch(() => ({})) as { result?: { cid?: string }; error?: { message?: string } };
  if (json.error?.message) throw new Error(json.error.message);
  const cid = json.result?.cid;
  if (!cid) throw new Error('Pineapple returned no CID');
  return `${IPFS_GATEWAY}${cid}`;
}

/** Send several attachments as ONE XMTP message using the multi-remote-attachment
 *  content type. Each file is encrypted on-device (native `encryptAttachment`),
 *  its ciphertext uploaded to IPFS, and the resulting URL + decryption metadata
 *  bundled into a single `multiRemoteAttachment` payload. This replaces the old
 *  "one inline StaticAttachment message per file" loop — recipients now get a
 *  single message + there's no ~800 KB inline cap (the bytes ride IPFS, not the
 *  MLS envelope). Returns the message id. */
export async function xmtpSendMultiRemoteAttachment(
  line: string, files: LocalAttachmentInput[],
): Promise<string> {
  if (files.length === 0) throw new Error('No attachments to send.');
  const conv = await convOfLine(line);
  if (!conv) throw new Error(`XMTP conversation not found: ${line}`);
  const client = getCachedXmtpClient() ?? await getOrCreateXmtpClient('production');

  const infos: RemoteAttachmentInfo[] = [];
  for (const f of files) {
    /** Native `encryptAttachment` hard-requires a `file://` uri. Picker results
     *  vary by platform/source:
     *   - voice recorder / expo-image-picker copies → already `file://…`
     *   - Android gallery (`MediaLibrary` fallback when ACCESS_MEDIA_LOCATION is
     *     denied) → `content://…`
     *   - web → `blob:…`
     *  Anything that isn't `file://` is materialised into the cache dir first.
     *  The previous `file://${…}` string-prefix hack turned `content://x` into
     *  `file://content://x`, which the native side rejected — gallery images on
     *  Android never sent. */
    const fileUri = await materializeFileUri(f.fileUri);
    /** Never hand the native encoder an empty MIME — guarantee one from the
     *  filename extension as a last resort (matches the composer's `mimeOf`). */
    const mimeType = f.mimeType && f.mimeType.includes('/')
      ? f.mimeType
      : (EXT_MIME[f.filename.split('.').pop()?.toLowerCase() ?? ''] ?? 'application/octet-stream');
    const encrypted = await client.encryptAttachment({
      fileUri, mimeType, filename: f.filename,
    });
    const url = await uploadEncryptedToIpfs(encrypted.encryptedLocalFileUri, f.filename);
    /** `buildMultiRemoteAttachmentInfo` stitches the upload URL onto the encryption
     *  metadata (secret/salt/nonce/digest) the recipient needs to decrypt. */
    infos.push(MultiRemoteAttachmentCodec.buildMultiRemoteAttachmentInfo(url, encrypted.metadata));
  }

  const payload: MultiRemoteAttachmentContent = { attachments: infos };
  return await conv.send({ multiRemoteAttachment: payload });
}

/** Download + decrypt a single remote attachment to a local `file://` URI the RN
 *  `Image`/audio player can render. Used by the bubble renderer when it hits a
 *  `remote` attachment placeholder. The ciphertext is fetched from its IPFS URL,
 *  written to the cache dir, then handed to the native `decryptAttachment` with
 *  the metadata that travelled in the message. */
export async function resolveRemoteAttachment(info: RemoteAttachmentInfo): Promise<{
  fileUri: string; mimeType?: string; filename?: string;
}> {
  const client = getCachedXmtpClient() ?? await getOrCreateXmtpClient('production');
  /** Unique cache filename so concurrent resolves don't collide. */
  const tmpName = `xmtp-att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.bin`;
  const dest = new File(Paths.cache, tmpName);
  if (dest.exists) try { dest.delete(); } catch { /* overwrite below */ }
  await File.downloadFileAsync(info.url, dest, { idempotent: true });
  const metadata: RemoteAttachmentMetadata = {
    secret: info.secret, salt: info.salt, nonce: info.nonce,
    contentDigest: info.contentDigest, contentLength: info.contentLength,
    filename: info.filename,
  };
  const encrypted: EncryptedLocalAttachment = {
    encryptedLocalFileUri: dest.uri.startsWith('file://') ? dest.uri : `file://${dest.uri.replace(/^file:\/+/, '/')}`,
    metadata,
  };
  const decrypted = await client.decryptAttachment(encrypted);
  return { fileUri: decrypted.fileUri, mimeType: decrypted.mimeType, filename: decrypted.filename };
}

export type XmtpFeedStatus = 'idle' | 'loading' | 'open' | 'error';

/** Hook: load the existing message history for an XMTP conversation, then subscribe
 *  to its live stream. Returned `events` are in the same newest-first ordering the
 *  `useTail` SSE hook uses, so the inverted FlatList can render them unchanged.
 *
 *  Caller passes a metro line URI (`metro://xmtp/<convId>`). When `enabled` is
 *  false, the hook stays idle — callers use this to suppress loading until the
 *  client is built. */
/** Per-conversation message cache so re-opening a channel renders its messages
 *  instantly (no empty-state flash); the network history still refreshes in the
 *  background. Survives navigation within the session. */
const feedCache = new MemoryStore<string, HistoryEntry[]>();

/** ───────────────────────────────────────────────────────────────────────────
 *  SINGLE GLOBAL MESSAGE STREAM (#6)
 *
 *  Previously every open `useXmtpFeed` started its OWN per-conversation
 *  `streamMessages` + a 5s `setInterval` poll. With several channels open that
 *  meant N native streams + N polls hammering the XMTP read-rate limit (which
 *  previously caused an outage) and the battery.
 *
 *  Now there is exactly ONE module-level `streamAllMessages` fan-out for the
 *  whole app. Each inbound message is decoded once, routed into the relevant
 *  conv's `feedCache` slice, and pushed to that slice's subscribers. A single
 *  low-frequency (30s) global resync + an AppState-resume resync act as the only
 *  backstops (the RN native stream can silently die on backgrounding/blips).
 *
 *  `useXmtpFeed` no longer owns a stream or a poll — it subscribes to its conv's
 *  feedCache slice. The channels list keeps its own `streamAllMessages` (it needs
 *  the row/preview/unread bookkeeping), so this fan-out is scoped to the
 *  conversation-view feed only.
 *  ─────────────────────────────────────────────────────────────────────────── */

/** Append a decoded message to a conv's cached slice (newest-first, deduped),
 *  notifying that slice's subscribers via the MemoryStore. Returns nothing. */
function pushToFeedSlice(line: string, env: HistoryEntry): void {
  const prev = feedCache.get(line) ?? [];
  if (prev.some(e => e.id === env.id)) return;
  feedCache.set(line, [env, ...prev]);
}

/** A decoded inbound message, routed to channels-list subscribers (#1). Carries
 *  the conv id + the pre-decoded preview/sender so the list doesn't re-decode
 *  (the conv-view feedCache slice gets the same message via pushToFeedSlice). */
export interface StreamMsg {
  convId: string | null;
  /** The raw RN DecodedMessage — subscribers read senderInboxId/sentNs/id/
   *  content()/contentTypeId off it (channels list needs preview + sender). */
  msg: DecodedMessage;
}

/** Channels-list subscribers to the SINGLE global stream (#1). index.tsx
 *  subscribes here instead of starting its own `streamAllMessages`, so each
 *  inbound is decoded once and routed to BOTH the feedCache slice (conv view)
 *  AND these subscribers (row/preview/unread bookkeeping). */
const streamSubscribers = new Set<(m: StreamMsg) => void>();
export function subscribeAllMessages(cb: (m: StreamMsg) => void): () => void {
  streamSubscribers.add(cb);
  /** Ensure the one app-wide stream is running once anyone subscribes. */
  void ensureGlobalStream();
  return () => { streamSubscribers.delete(cb); };
}

let globalStreamCancel: (() => void) | null = null;
let globalStreamStarting = false;
let globalResyncTimer: ReturnType<typeof setInterval> | null = null;
let globalAppStateSub: { remove: () => void } | null = null;
/** Conv lines with at least one live subscriber — drives which slices the global
 *  resync backstop refreshes (we don't resync every conv the inbox has ever
 *  seen, only the ones currently being viewed). */
const activeFeedLines = new Set<string>();

/** Resync the currently-subscribed conv slices from the local store. Cheap
 *  backstop for anything the native stream dropped. */
async function resyncActiveFeeds(): Promise<void> {
  for (const line of activeFeedLines) {
    try {
      const conv = await convOfLine(line);
      if (!conv) continue;
      await conv.sync().catch(() => undefined);
      const msgs = await conv.messages({ limit: PAGE_SIZE });
      for (const m of msgs.reverse()) {
        const env = envelopeOfXmtpMessage(m, line);
        if (!isMetroControlBody(env.text)) pushToFeedSlice(line, env);
      }
    } catch { /* best-effort — next tick retries */ }
  }
}

/** Lazily start the single app-wide message stream + its backstops. Idempotent;
 *  safe to call from every `useXmtpFeed` mount. */
async function ensureGlobalStream(): Promise<void> {
  if (globalStreamCancel || globalStreamStarting) return;
  globalStreamStarting = true;
  try {
    const client = getCachedXmtpClient() ?? await getOrCreateXmtpClient('production');
    /** A single native subscription for every conversation on this inbox. We map
     *  each message to the metro line via its conversation/topic id and route it
     *  into the matching feedCache slice. */
    await client.conversations.streamAllMessages(async (msg) => {
      if (!msg) return;
      const convId = (msg as unknown as { conversationId?: string }).conversationId
        ?? convIdFromTopicStr((msg as unknown as { topic?: string }).topic);
      /** Fan out the raw message to channels-list subscribers FIRST (#1) — they
       *  do their own control-DM filtering + need the raw msg for preview/sender.
       *  One decode, two consumers. */
      if (streamSubscribers.size > 0) {
        for (const cb of streamSubscribers) { try { cb({ convId: convId ?? null, msg }); } catch { /* ignore */ } }
      }
      if (!convId) return;
      const line = lineOfConv(convId);
      const env = envelopeOfXmtpMessage(msg, line);
      if (isMetroControlBody(env.text)) return;
      pushToFeedSlice(line, env);
    });
    /** Cancellation is via the SDK's imperative `cancelStreamAllMessages` (the
     *  stream starter itself resolves to void). */
    globalStreamCancel = () => {
      try { client.conversations.cancelStreamAllMessages(); } catch { /* ignore */ }
    };
    /** One low-frequency global resync — replaces the old per-conv 5s poll. */
    if (!globalResyncTimer) globalResyncTimer = setInterval(() => { void resyncActiveFeeds(); }, 30_000);
    if (!globalAppStateSub) {
      globalAppStateSub = AppState.addEventListener('change', (state) => {
        if (state === 'active') void resyncActiveFeeds();
      });
    }
  } catch { /* stream init failed — resync backstop still covers active feeds */ }
  finally { globalStreamStarting = false; }
}

/** Tear down the global stream + backstops. Called when the active account
 *  changes so the next account starts a fresh stream against its own inbox. */
function teardownGlobalStream(): void {
  if (globalStreamCancel) { globalStreamCancel(); globalStreamCancel = null; }
  if (globalResyncTimer) { clearInterval(globalResyncTimer); globalResyncTimer = null; }
  if (globalAppStateSub) { try { globalAppStateSub.remove(); } catch { /* ignore */ } globalAppStateSub = null; }
}

/** Extract a conv id from an MLS topic (`/xmtp/mls/1/g-<hexId>/proto`). The RN
 *  `DecodedMessage` from `streamAllMessages` exposes `topic` but not always
 *  `conversationId`. */
function convIdFromTopicStr(topic: string | undefined): string | null {
  if (!topic) return null;
  const m = /\/g-([0-9a-fA-F]+)\//.exec(topic);
  return m ? m[1]! : null;
}

/** First-page + per-scroll-up page size. Opening a conversation used to decode
 *  100 messages up front (~150–220ms on-device, on the critical path before first
 *  paint); a small first page paints fast and older pages stream in on scroll-up. */
const PAGE_SIZE = 20;

export function useXmtpFeed(line: string | null, enabled: boolean): {
  events: HistoryEntry[]; status: XmtpFeedStatus; error: string | null; inboxId: string;
  loadOlder: () => Promise<void>; hasMore: boolean; loadingOlder: boolean;
} {
  /** Re-init the feed when the active account changes (in-place switch) — the
   *  cached client + feedCache have been swapped out under us, so re-run the
   *  effect against the new inbox without a hard reload. */
  const accountEpoch = useAccountEpoch();
  const [events, setEvents] = useState<HistoryEntry[]>(() => (line ? feedCache.get(line) ?? [] : []));
  const [status, setStatus] = useState<XmtpFeedStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [inboxId, setInboxId] = useState<string>('');
  const [hasMore, setHasMore] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  /** Latest events held in a ref so the stable `loadOlder` callback can read the
   *  current tail (oldest loaded event = pagination cursor) without re-creating
   *  itself on every render. */
  const eventsRef = useRef<HistoryEntry[]>(events);
  eventsRef.current = events;
  const loadingOlderRef = useRef(false);
  const hasMoreRef = useRef(true);
  hasMoreRef.current = hasMore;
  const lineRef = useRef(line);
  lineRef.current = line;

  useEffect(() => {
    if (!enabled || !line) { setStatus('idle'); return; }
    const ln = line;
    let cancelled = false;
    /** Seeded from cache → already 'open' (skip the spinner); otherwise show the
     *  loading spinner until the first refresh lands. */
    setStatus(feedCache.get(ln)?.length ? 'open' : 'loading');
    setError(null);
    setEvents(feedCache.get(ln) ?? []);
    /** Fresh conversation → reset older-page pagination so scroll-up can fetch
     *  history again from the new conv's tail. */
    setHasMore(true);
    setLoadingOlder(false);
    loadingOlderRef.current = false;

    /** Mark this conv as having a live viewer so the single global resync
     *  backstop keeps its slice fresh, and ensure the one app-wide message
     *  stream is running. No per-conv stream + no per-conv poll any more — the
     *  module-level `streamAllMessages` fan-out (see ensureGlobalStream) routes
     *  inbound messages straight into `feedCache`, which we subscribe to below. */
    activeFeedLines.add(ln);
    void ensureGlobalStream();

    /** Subscribe to this conv's feedCache slice. The global stream + the initial
     *  load + the resync backstop all write through `pushToFeedSlice`/`feedCache`,
     *  which fires this callback. Mirror the slice into local `events` state. */
    const unsubscribe = feedCache.subscribe(ln, (slice) => {
      if (cancelled || !slice) return;
      setEvents(slice);
    });

    /** Map decoded messages → envelopes and merge into the conv's feedCache slice
     *  (dedup by id, newest-first). Drops our private register-push control DMs —
     *  they ride plain text but must never render as chat bubbles. */
    const applyMessages = (msgs: DecodedMessage[]): void => {
      const prev = feedCache.get(ln) ?? [];
      const seen = new Set(prev.map(e => e.id));
      const additions = msgs.map(m => envelopeOfXmtpMessage(m, ln))
        .filter(e => !isMetroControlBody(e.text) && !seen.has(e.id));
      if (additions.length === 0) {
        /** Still surface the cached slice on the very first paint. */
        if (prev.length > 0) setEvents(prev);
        return;
      }
      /** `messages()` returns newest-first; merge new items into the same ordering. */
      feedCache.set(ln, [...additions, ...prev]);
    };

    /** Local-first open: paint whatever is already in the local MLS db
     *  IMMEDIATELY, before the network sync, then reconcile with the network. */
    const refresh = async (): Promise<void> => {
      try {
        const conv = await convOfLine(ln);
        if (!conv || cancelled) return;
        const local = await conv.messages({ limit: PAGE_SIZE });
        if (cancelled) return;
        applyMessages(local);
        await conv.sync().catch(() => undefined);
        if (cancelled) return;
        const synced = await conv.messages({ limit: PAGE_SIZE });
        if (cancelled) return;
        applyMessages(synced);
      } catch { /* swallow — global resync backstop will retry */ }
    };

    (async (): Promise<void> => {
      try {
        const client = await getOrCreateXmtpClient('production');
        if (cancelled) return;
        setInboxId(client.inboxId);
        await refresh();
        setStatus('open');
      } catch (e) {
        if (cancelled) return;
        setStatus('error');
        setError((e as Error).message);
      }
    })();
    return (): void => {
      cancelled = true;
      unsubscribe();
      activeFeedLines.delete(ln);
    };
  }, [line, enabled, accountEpoch]);

  /** Fetch the next older page on scroll-up. Events are newest-first, so the LAST
   *  loaded event is the oldest; its `sentNs` is the cursor. The RN SDK's
   *  `Conversation.messages({ limit, beforeNs, direction })` (MessagesOptions,
   *  direction defaults to DESCENDING = newest-first) returns the `limit` messages
   *  sent strictly before `beforeNs`, still newest-first — so we APPEND them to the
   *  end of `events`, preserving the newest-first ordering the inverted list wants.
   *  Stable identity (deps are only refs) so the FlatList's onEndReached prop never
   *  churns. Never throws. */
  const loadOlder = useCallback(async (): Promise<void> => {
    const ln = lineRef.current;
    if (loadingOlderRef.current || !hasMoreRef.current || !ln) return;
    const oldest = eventsRef.current[eventsRef.current.length - 1];
    if (!oldest) return;
    /** `oldest.ts` is the ISO ms timestamp the envelope was built from `sentNs`;
     *  reconstruct the ns cursor (the SDK only loses sub-ms precision, which is
     *  fine for a strict before-cursor on distinct messages). */
    const beforeNs = new Date(oldest.ts).getTime() * 1_000_000;
    loadingOlderRef.current = true;
    setLoadingOlder(true);
    try {
      const conv = await convOfLine(ln);
      if (!conv) return;
      const older = await conv.messages({
        limit: PAGE_SIZE,
        beforeNs,
        direction: 'DESCENDING',
      });
      const mapped = older
        .map(m => envelopeOfXmtpMessage(m, ln))
        .filter(e => !isMetroControlBody(e.text));
      /** Write older pages through feedCache (the single source of truth) so the
       *  slice subscription keeps them — append to the END to keep newest-first. */
      const prev = feedCache.get(ln) ?? eventsRef.current;
      const seen = new Set(prev.map(e => e.id));
      const additions = mapped.filter(e => !seen.has(e.id));
      if (additions.length > 0) feedCache.set(ln, [...prev, ...additions]);
      /** Fewer than a full page of NEW older messages came back → end of history. */
      const newCount = mapped.filter(e => !eventsRef.current.some(x => x.id === e.id)).length;
      if (newCount < PAGE_SIZE) { hasMoreRef.current = false; setHasMore(false); }
    } catch { /* best-effort — scroll-up will retry on the next onEndReached */ }
    finally {
      loadingOlderRef.current = false;
      setLoadingOlder(false);
    }
  }, []);

  return { events, status, error, inboxId, loadOlder, hasMore, loadingOlder };
}

/** Read a local file URI into a base64 string. Used to wrap picker results in the
 *  shape `xmtpSendAttachment` expects. */
export async function fileUriToBase64(uri: string): Promise<string> {
  const res = await fetch(uri);
  const blob = await res.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (): void => {
      const result = reader.result;
      if (typeof result !== 'string') { reject(new Error('FileReader returned non-string')); return; }
      /** `data:<mime>;base64,<payload>` — strip the prefix. */
      const comma = result.indexOf(',');
      resolve(comma === -1 ? result : result.slice(comma + 1));
    };
    reader.onerror = (): void => reject(reader.error ?? new Error('FileReader failed'));
    reader.readAsDataURL(blob);
  });
}
