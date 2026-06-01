/** Push-title resolution (inbox→addr→profile name) + inbound push fan-out. */

import { IdentifierKind, type DecodedMessage } from '@xmtp/node-sdk';
import { accounts, parseLine } from './xmtp-accounts.js';
import { fcmPushToAll } from './xmtp-push.js';

// Lazy per-inbox/address caches for push titles. One fetchInboxStates per unique
// sender (NOT bulk — that caused the rate-limit outage); cached for process life.
const inboxAddrCache = new Map<string, string>();

async function resolveInboxAddress(accountId: string, inboxId: string): Promise<string> {
  if (!inboxId) return '';
  const hit = inboxAddrCache.get(inboxId);
  if (hit !== undefined) return hit;
  let addr = '';
  try {
    const client = accounts.get(accountId)?.client;
    if (client) {
      const states = await client.preferences.fetchInboxStates([inboxId]);
      const eth = states[0]?.identifiers.find(
        (it: { identifierKind: IdentifierKind }) => it.identifierKind === IdentifierKind.Ethereum);
      addr = eth?.identifier ?? '';
    }
  } catch { /* best-effort — fall back to inbox prefix */ }
  inboxAddrCache.set(inboxId, addr);
  return addr;
}
export const shortAddr = (a: string): string => (a.length > 10 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a);

// Lazy address→Snapshot-profile-name cache (hub.snapshot.org `user(id){name}`),
// mirroring the app so notifications show the sender's username, else short addr.
const SNAPSHOT_HUB_GRAPHQL = 'https://hub.snapshot.org/graphql';
const profileNameCache = new Map<string, string>();
export async function resolveProfileName(address: string): Promise<string> {
  const key = address.toLowerCase();
  const hit = profileNameCache.get(key);
  if (hit !== undefined) return hit;
  let name = '';
  try {
    const res = await fetch(SNAPSHOT_HUB_GRAPHQL, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: 'query U($id:String!){user(id:$id){name}}', variables: { id: key } }),
    });
    if (res.ok) {
      const j = await res.json() as { data?: { user?: { name?: string } } };
      name = (j.data?.user?.name ?? '').trim();
    }
  } catch { /* best-effort — fall back to address */ }
  profileNameCache.set(key, name);
  return name;
}

/** Reaction → emoji ("[react 🔥]" → "🔥"); voice/audio → "🎤"; else unchanged. */
export function humanizePushPreview(t: string): string {
  const react = /^\[react (.+?)(?: \(removed\))?\]$/.exec(t);
  if (react) return react[1];
  if (/^\[audio[:\]]/.test(t)) return '🎤';
  return t;
}

async function pushTitleBody(
  accountId: string, env: Record<string, unknown>, msg: DecodedMessage,
): Promise<{ title: string; body: string; avatarUrl?: string }> {
  const ptyId = msg.contentType?.typeId;
  const raw = ptyId === 'walletSendCalls' ? '💸 Payment request'
    : ptyId === 'transactionReference' ? '🧾 Transaction'
      : ptyId === 'signatureRequest' ? '✍️ Signature request'
        : ptyId === 'signatureReference' ? '✍️ Signature'
          : humanizePushPreview(typeof env.text === 'string' ? env.text : '');
  const body = raw.length > 140 ? `${raw.slice(0, 137)}…` : (raw || 'New message');
  const addr = await resolveInboxAddress(accountId, msg.senderInboxId ?? '');
  const name = addr ? await resolveProfileName(addr) : '';
  const inboxFallback = msg.senderInboxId
    ? `${msg.senderInboxId.slice(0, 6)}…${msg.senderInboxId.slice(-4)}` : 'New message';
  const title = name || (addr ? shortAddr(addr) : inboxFallback);
  const avatarUrl = addr ? `https://stamp.fyi/avatar/eth:${addr}?s=128` : undefined;
  return { title, body, avatarUrl };
}

/** F1 + E1: fan out an FCM push to the receiving account's tokens for a real
 *  inbound message. Caller filters own/echo + SILENT_TYPES + control DMs. */
export function pushInbound(
  accountId: string, env: Record<string, unknown>, msg: DecodedMessage, conv?: unknown,
): void {
  const line = typeof env.line === 'string' ? env.line : '';
  const messageId = typeof env.message_id === 'string'
    ? env.message_id : (typeof env.id === 'string' ? env.id : '');
  void (async (): Promise<void> => {
    const { title, body, avatarUrl } = await pushTitleBody(accountId, env, msg);
    const data: Record<string, string> = { line, messageId };
    { const p = parseLine(line); if (p) data.convId = p.convId; }
    if (avatarUrl) data.avatarUrl = avatarUrl;
    // Group rendering hints for MetroFcmService: DMs expose peerInboxId(); groups
    // don't. Group title = conv.name (string or async fn). FCM data is string-only.
    if (conv) {
      const isDm = typeof (conv as { peerInboxId?: unknown }).peerInboxId === 'function';
      if (!isDm) {
        data.isGroup = 'true';
        const gn = (conv as { name?: string | (() => Promise<string>) }).name;
        const resolvedName = typeof gn === 'function' ? await gn().catch(() => '') : (gn ?? '');
        if (resolvedName) data.groupTitle = resolvedName;
      }
    }
    await fcmPushToAll(accountId, title, body, data, msg.senderInboxId);
  })().catch(() => undefined);
}
