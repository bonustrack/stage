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

import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { Directory, Paths } from 'expo-file-system';
import {
  Client, PublicIdentity,
  ReactionCodec, ReplyCodec, StaticAttachmentCodec, RemoteAttachmentCodec,
  GroupUpdatedCodec,
  type Conversation, type DecodedMessage, type ConversationVersion,
  type ReactionContent, type ReplyContent, type StaticAttachmentContent,
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
  new GroupUpdatedCodec(),
];
import type { HistoryEntry } from './types';
import {
  getActiveAccount, addGeneratedAccount, getViemAccount,
  loadAccounts, setActiveAccountId, markRegistered, removeAccount, clearAllAccounts,
  type AccountRecord,
} from './accounts';
import { humanizeGroupUpdated, type GroupUpdatedContent } from '../../_shared/xmtp/humanize';

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
    throw new Error('WalletConnect signing is not available in this build yet.');
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
  return cachedClient;
}

/** Switch the active account: drop the cached client and rebuild against the
 *  target account's db. Callers typically reload the app afterwards so every
 *  screen re-inits against the new inbox. */
export async function switchToAccount(id: string, env: XmtpEnv = 'production'): Promise<Client> {
  const list = await loadAccounts();
  const rec = list.find(a => a.id === id);
  if (!rec) throw new Error('Account not found.');
  cachedClient = null;
  await setActiveAccountId(id);
  return buildClientForAccount(rec, env);
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
  cachedClient = null;
}

/** Full wipe: drop the cached client, every account's on-disk XMTP store (plus
 *  the legacy `xmtp/` dir), the shared db key, and the whole account registry.
 *  Next call to `getOrCreateXmtpClient` mints a fresh wallet + inbox. */
export async function resetXmtpClient(): Promise<void> {
  cachedClient = null;
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
  try {
    const raw = await SecureStore.getItemAsync(LAST_READ_PREFIX + convId);
    if (!raw) return 0;
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  } catch { return 0; }
}
export async function setLastReadNs(convId: string, ns: number): Promise<void> {
  try { await SecureStore.setItemAsync(LAST_READ_PREFIX + convId, String(ns)); }
  catch { /* best-effort */ }
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
const inboxEthCache = new Map<string, string>();

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

/** Hardcoded co-members for the "Ask a question" group: claude (the daemon's
 *  XMTP identity) + Less (the project owner). Lowercased on the way out so
 *  dedup against the local wallet is case-insensitive. */
export const ASK_QUESTION_MEMBERS = [
  '0x0bA043c6F25085C68042bad079c29bD8f16a651A', // claude (daemon xmtp train)
  '0x25391bddaa8d7ecdfe183615c1005259cd3b79d5', // Less
] as const;

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

/** Spin up a 3-party group with the local user, claude, and Less. The local
 *  wallet is implicitly added as the creator; any address in ASK_QUESTION_MEMBERS
 *  that matches the local wallet (i.e. when Less or claude themselves tap the
 *  button) is filtered out. Returns the new conversation's id. */
export async function createAskQuestionGroup(): Promise<string> {
  const client = await getOrCreateXmtpClient('production');
  const selfAddr = client.publicIdentity.identifier.toLowerCase();
  const peers = ASK_QUESTION_MEMBERS
    .filter(a => a.toLowerCase() !== selfAddr)
    .map(a => new PublicIdentity(a, 'ETHEREUM'));
  const group = await client.conversations.newGroupWithIdentities(peers, {
    name: 'Ask a question',
  });
  return group.id;
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

export type { ConversationVersion };

/** URI prefix used for inbound XMTP "from" addresses. Mirrors the daemon-side train
 *  (`packages/metro/examples/xmtp.ts`) so the rest of the app can rely on a single
 *  convention. */
export const XMTP_USER_PREFIX = 'metro://xmtp/user/';

/** True when a metro line URI points at an XMTP conversation. */
export function isXmtpLine(line: string | undefined | null): boolean {
  return !!line && line.startsWith('metro://xmtp/');
}

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
const feedCache = new Map<string, HistoryEntry[]>();

export function useXmtpFeed(line: string | null, enabled: boolean): {
  events: HistoryEntry[]; status: XmtpFeedStatus; error: string | null; inboxId: string;
} {
  const [events, setEvents] = useState<HistoryEntry[]>(() => (line ? feedCache.get(line) ?? [] : []));
  const [status, setStatus] = useState<XmtpFeedStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [inboxId, setInboxId] = useState<string>('');

  useEffect(() => {
    if (!enabled || !line) { setStatus('idle'); return; }
    let cancelled = false;
    let unsubscribeStream: (() => void) | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let appStateSub: { remove: () => void } | null = null;
    /** Seeded from cache → already 'open' (skip the spinner); otherwise show the
     *  loading spinner until the first refresh lands. */
    setStatus(feedCache.get(line)?.length ? 'open' : 'loading');
    setError(null);

    /** Re-sync from the network + merge any new messages into `events`. Called on the
     *  initial mount, on app foreground, every 5s as a stream-died backstop, and after
     *  the per-conv streamMessages callback fires. Idempotent — already-seen ids are
     *  filtered out via the id check. */
    const refresh = async (): Promise<void> => {
      try {
        const conv = await convOfLine(line);
        if (!conv || cancelled) return;
        await conv.sync().catch(() => undefined);
        const msgs = await conv.messages({ limit: 100 });
        if (cancelled) return;
        const fresh = msgs.map(m => envelopeOfXmtpMessage(m, line));
        setEvents(prev => {
          if (prev.length === 0) return fresh;
          const seen = new Set(prev.map(e => e.id));
          const additions = fresh.filter(e => !seen.has(e.id));
          if (additions.length === 0) return prev;
          /** `messages()` returns newest-first; merge new items into the same ordering. */
          return [...additions, ...prev];
        });
      } catch { /* swallow — next tick or AppState change will retry */ }
    };

    (async (): Promise<void> => {
      try {
        const client = await getOrCreateXmtpClient('production');
        if (cancelled) return;
        setInboxId(client.inboxId);
        await refresh();
        setStatus('open');
        /** Per-conv streamMessages — primary live source. The RN SDK's native stream can
         *  silently die on network blips, app backgrounding, or after long idles — we
         *  paper over that with the AppState + poll backstops below. */
        try {
          unsubscribeStream = await (await convOfLine(line))?.streamMessages(async (msg) => {
            if (cancelled) return;
            const env = envelopeOfXmtpMessage(msg, line);
            setEvents(prev => prev.some(e => e.id === env.id) ? prev : [env, ...prev]);
          }) ?? null;
        } catch { /* stream init failed — backstops will keep the feed fresh */ }
        /** Foreground-resume: when the user comes back to the app, the stream may have
         *  died while suspended. Re-sync explicitly. */
        appStateSub = AppState.addEventListener('change', (state) => {
          if (state === 'active') void refresh();
        });
        /** Slow poll as a last-resort backstop — picks up anything the stream missed. */
        pollTimer = setInterval(() => { void refresh(); }, 5_000);
      } catch (e) {
        if (cancelled) return;
        setStatus('error');
        setError((e as Error).message);
      }
    })();
    return (): void => {
      cancelled = true;
      if (unsubscribeStream) try { unsubscribeStream(); } catch { /* ignore */ }
      if (pollTimer) clearInterval(pollTimer);
      if (appStateSub) try { appStateSub.remove(); } catch { /* ignore */ }
    };
  }, [line, enabled]);

  /** Keep the per-conversation cache in sync so the next open is instant. */
  useEffect(() => {
    if (line && events.length > 0) feedCache.set(line, events);
  }, [line, events]);

  return { events, status, error, inboxId };
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
