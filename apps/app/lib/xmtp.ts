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
import { loadOrCreateAccount, resetAccount } from './wallet';

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

export type XmtpEnv = 'production' | 'dev' | 'local';

/** SecureStore keys must match `[A-Za-z0-9._-]+` — colons are rejected on Android, which
 *  surfaced as an `Invalid key provided to SecureStore` runtime crash on Less's device. */
const ADDRESS_KEY = 'xmtp.address';
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
function dbDirObj(): Directory { return new Directory(Paths.document, 'xmtp'); }

async function ensureDbDir(): Promise<string> {
  const dir = dbDirObj();
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
  const dbDirectory = await ensureDbDir();
  const dbEncryptionKey = await loadOrCreateDbKey();
  const opts = { env, dbDirectory, dbEncryptionKey, codecs: XMTP_CODECS };
  const account = await loadOrCreateAccount();
  const savedAddress = await SecureStore.getItemAsync(ADDRESS_KEY).catch(() => null);
  const savedEnv = await SecureStore.getItemAsync(ENV_KEY).catch(() => null);
  /** Rebuild only if we have a saved address that matches the local EOA AND the env. */
  if (savedAddress && savedEnv === env
    && savedAddress.toLowerCase() === account.address.toLowerCase()) {
    try {
      /** Race Client.build against a 20s timeout — MLS state replay can hang
       *  indefinitely on a corrupted local store, and the user has no way to
       *  recover without either a manual nuke or the "Reset XMTP" action. */
      const built = await Promise.race<Client | null>([
        Client.build(new PublicIdentity(savedAddress, 'ETHEREUM'), opts),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 20_000)),
      ]);
      if (built) {
        cachedClient = built;
        return cachedClient;
      }
      /** Build timed out — fall through to create() with a fresh registration. */
    } catch { /* fall through to create() if rebuild failed */ }
  }
  /** XMTP registers a new installation by asking the EOA to sign its handshake
   *  challenge. Pure-JS viem signing — no user-facing prompt. */
  const signer = signerForAccount(account);
  cachedClient = await Client.create(signer, opts);
  await SecureStore.setItemAsync(ADDRESS_KEY, cachedClient.publicIdentity.identifier);
  await SecureStore.setItemAsync(ENV_KEY, env);
  return cachedClient;
}

export function getCachedXmtpClient(): Client | null { return cachedClient; }

/** Drop the local XMTP identity AND the EOA backing it (key store + cached client).
 *  Next call to `getOrCreateXmtpClient` will mint a fresh wallet + inbox. */
export async function resetXmtpClient(): Promise<void> {
  cachedClient = null;
  await SecureStore.deleteItemAsync(ADDRESS_KEY).catch(() => undefined);
  await SecureStore.deleteItemAsync(ENV_KEY).catch(() => undefined);
  await SecureStore.deleteItemAsync(DB_ENCRYPTION_KEY).catch(() => undefined);
  await resetAccount();
  const dir = dbDirObj();
  if (dir.exists) dir.delete();
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

/** Resolve the peer's Ethereum address for a DM conversation. Returns null for
 *  groups or when the lookup fails (uncached peer, network blip, etc.). */
export async function peerEthAddressOfDm(conv: Conversation): Promise<string | null> {
  /** `version` is 'DM' | 'GROUP'; only DMs have a single peer. */
  if ((conv as unknown as { version?: string }).version !== 'DM') return null;
  const dm = conv as unknown as { peerInboxId: () => Promise<string> };
  try {
    const inboxId = await dm.peerInboxId();
    const client = getCachedXmtpClient() ?? await getOrCreateXmtpClient('production');
    /** Same network-fetch reason as `groupMemberEthAddresses` — fresh peers
     *  may not be in the cache yet on the first render after creation. */
    const states = await client.inboxStates(true, [inboxId as Parameters<typeof client.inboxStates>[1][number]]);
    const eth = states[0]?.identities.find(i => i.kind === 'ETHEREUM');
    return eth?.identifier ?? null;
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
    if (ids.length === 0) return {};
    /** `inboxStates` returns results in request order — pair them back to the inbox ids. */
    const states = await client.inboxStates(
      true,
      ids as Parameters<typeof client.inboxStates>[1],
    );
    const map: Record<string, string> = {};
    for (let i = 0; i < ids.length; i++) {
      const s = states[i];
      if (!s) continue;
      const eth = s.identities.find(it => it.kind === 'ETHEREUM');
      if (eth?.identifier) map[ids[i]!] = eth.identifier;
    }
    return map;
  } catch (err) {
    process.env.NODE_ENV !== 'production' && console.warn('memberInboxToAddressMap failed', (err as Error).message);
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
    if (otherIds.length === 0) return [];
    /** `refreshFromNetwork=true` — for newly-created groups the local inbox-state
     *  cache may not yet have the Ethereum identity for every member, so a
     *  cache-only lookup returns no addresses (and the row falls back to its
     *  topic-suffix title like "proto" instead of a member count). */
    const states = await client.inboxStates(
      true,
      otherIds as Parameters<typeof client.inboxStates>[1],
    );
    const addrs: string[] = [];
    for (const s of states) {
      const eth = s.identities.find(i => i.kind === 'ETHEREUM');
      if (eth?.identifier) addrs.push(eth.identifier);
    }
    return addrs;
  } catch (err) {
    process.env.NODE_ENV !== 'production' && console.warn('groupMemberEthAddresses failed', (err as Error).message);
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
    /** Human-readable summary of a group metadata change — rename, add/remove
     *  members, image swap. Falls back to a generic line if the payload shape
     *  doesn't match what we expect. */
    const g = decoded as {
      initiatedByInboxId?: string;
      membersAdded?: { inboxId: string }[];
      membersRemoved?: { inboxId: string }[];
      metadataFieldsChanged?: { fieldName: string; oldValue: string; newValue: string }[];
    };
    const parts: string[] = [];
    for (const f of g.metadataFieldsChanged ?? []) {
      if (f.fieldName === 'group_name') parts.push(`renamed the group to "${f.newValue}"`);
      else if (f.fieldName === 'group_image_url_square') parts.push('updated the group image');
      else if (f.fieldName === 'description') parts.push('updated the group description');
      else parts.push(`changed ${f.fieldName.replace(/_/g, ' ')}`);
    }
    if ((g.membersAdded ?? []).length) parts.push(`added ${g.membersAdded!.length} member${g.membersAdded!.length === 1 ? '' : 's'}`);
    if ((g.membersRemoved ?? []).length) parts.push(`removed ${g.membersRemoved!.length} member${g.membersRemoved!.length === 1 ? '' : 's'}`);
    const summary = parts.length ? parts.join(' • ') : 'updated the group';
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
export function useXmtpFeed(line: string | null, enabled: boolean): {
  events: HistoryEntry[]; status: XmtpFeedStatus; error: string | null; inboxId: string;
} {
  const [events, setEvents] = useState<HistoryEntry[]>([]);
  const [status, setStatus] = useState<XmtpFeedStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [inboxId, setInboxId] = useState<string>('');

  useEffect(() => {
    if (!enabled || !line) { setStatus('idle'); return; }
    let cancelled = false;
    let unsubscribeStream: (() => void) | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let appStateSub: { remove: () => void } | null = null;
    setStatus('loading');
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
