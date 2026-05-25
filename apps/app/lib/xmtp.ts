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
import * as SecureStore from 'expo-secure-store';
import { Directory, Paths } from 'expo-file-system';
import {
  Client, PublicIdentity,
  type Conversation, type DecodedMessage, type ConversationVersion,
  type ReactionContent, type ReplyContent, type StaticAttachmentContent,
} from '@xmtp/react-native-sdk';
import type { HistoryEntry } from './types';

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
 *  Called from the app's root effect on startup. */
let cachedClient: Client | null = null;
export async function getOrCreateXmtpClient(env: XmtpEnv = 'production'): Promise<Client> {
  if (cachedClient) return cachedClient;
  const dbDirectory = await ensureDbDir();
  const dbEncryptionKey = await loadOrCreateDbKey();
  const opts = { env, dbDirectory, dbEncryptionKey };
  const savedAddress = await SecureStore.getItemAsync(ADDRESS_KEY).catch(() => null);
  const savedEnv = await SecureStore.getItemAsync(ENV_KEY).catch(() => null);
  /** Rebuild only if we have a saved address AND it matches the current env (different
   *  networks → different inboxes). Otherwise start fresh. */
  if (savedAddress && savedEnv === env) {
    try {
      cachedClient = await Client.build(new PublicIdentity(savedAddress, 'ETHEREUM'), opts);
      return cachedClient;
    } catch { /* fall through to createRandom if rebuild failed */ }
  }
  cachedClient = await Client.createRandom(opts);
  await SecureStore.setItemAsync(ADDRESS_KEY, cachedClient.publicIdentity.identifier);
  await SecureStore.setItemAsync(ENV_KEY, env);
  return cachedClient;
}

export function getCachedXmtpClient(): Client | null { return cachedClient; }

/** Drop the local XMTP identity (key store + cached client). Next call to
 *  `getOrCreateXmtpClient` will mint a fresh wallet. */
export async function resetXmtpClient(): Promise<void> {
  cachedClient = null;
  await SecureStore.deleteItemAsync(ADDRESS_KEY).catch(() => undefined);
  await SecureStore.deleteItemAsync(ENV_KEY).catch(() => undefined);
  await SecureStore.deleteItemAsync(DB_ENCRYPTION_KEY).catch(() => undefined);
  const dir = dbDirObj();
  if (dir.exists) dir.delete();
}

/** Format a metro-style line URI for an XMTP conversation. Mirrors the daemon train. */
export function lineOfConv(convId: string): string { return `metro://xmtp/${convId}`; }

/** Pretty-print a wallet address as `0x1234…abcd`. */
export function shortAddress(addr: string): string {
  if (!addr) return '';
  return addr.length > 10 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
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
    let unsubscribe: (() => void) | null = null;
    setStatus('loading');
    setError(null);
    (async (): Promise<void> => {
      try {
        const client = await getOrCreateXmtpClient('production');
        if (cancelled) return;
        setInboxId(client.inboxId);
        const conv = await convOfLine(line);
        if (!conv) throw new Error(`XMTP conversation not found: ${line}`);
        /** Fetch the latest network state before seeding history — otherwise we'd render only
         *  what the local sqlite cache happens to have. */
        await conv.sync().catch(() => { /* tolerate offline */ });
        const msgs = await conv.messages({ limit: 100 });
        if (cancelled) return;
        const seeded = msgs.map(m => envelopeOfXmtpMessage(m, line));
        /** `messages()` returns newest-first by default — matches the inverted FlatList expectation. */
        setEvents(seeded);
        setStatus('open');
        /** Live subscription. Native callback fires for each new message; we prepend so the
         *  newest is at index 0 (inverted-list convention). */
        unsubscribe = await conv.streamMessages(async (msg): Promise<void> => {
          if (cancelled) return;
          const env = envelopeOfXmtpMessage(msg, line);
          setEvents(prev => prev.some(e => e.id === env.id) ? prev : [env, ...prev]);
        });
      } catch (e) {
        if (cancelled) return;
        setStatus('error');
        setError((e as Error).message);
      }
    })();
    return (): void => {
      cancelled = true;
      if (unsubscribe) try { unsubscribe(); } catch { /* ignore */ }
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
