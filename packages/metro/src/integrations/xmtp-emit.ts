/** Inbound/outbound event emission: envelope projection, transcription, push. */

import type { Conversation, DecodedMessage } from '@xmtp/node-sdk';
import type { Reaction } from '@xmtp/content-type-reaction';
import type { Reply } from '@xmtp/content-type-reply';
import type { WalletSendCallsParams } from '@xmtp/content-type-wallet-send-calls';
import type { TransactionReference } from '@xmtp/content-type-transaction-reference';
import { accounts, lineOf, parseLine } from './xmtp-accounts.js';
import { emit, mintId, rememberUid, SELF_URI } from './xmtp-wire.js';
import { fcmPushToAll } from './xmtp-push.js';
import { humanizePushPreview, resolveProfileName, shortAddr } from './xmtp-push-title.js';
import { transcribeAndEmit } from './xmtp-transcribe.js';

/** Stamp account into payload and (if configured) owner-route inbound `to`. */
export function emitInbound(accountId: string, e: Record<string, unknown>): void {
  const acct = accounts.get(accountId);
  const owner = acct?.cfg.owner;
  const payload = { ...(e.payload as Record<string, unknown> | undefined), account: accountId };
  emit({ kind: 'inbound', ...e, ...(owner ? { to: owner } : {}), account: accountId, payload });
}

function reactionPayload(base: Record<string, unknown>, r: Reaction): Record<string, unknown> {
  // node-sdk decodes action/schema as a string ('added'/'unicode') OR a numeric
  // bindings enum (1/2/3). Normalise to lowercase strings for the app.
  const schemaStr = (() => {
    const s = (r as { schema?: unknown }).schema;
    if (typeof s === 'string') return s.toLowerCase();
    if (s === 3) return 'custom'; if (s === 2) return 'shortcode'; if (s === 1) return 'unicode';
    return undefined;
  })();
  const actionStr = (() => {
    const a = (r as { action?: unknown }).action;
    if (typeof a === 'string') return a.toLowerCase();
    if (a === 2) return 'removed'; if (a === 1) return 'added';
    return undefined;
  })();
  const removed = actionStr === 'removed';
  return {
    ...base, text: `[react ${r.content ?? ''}${removed ? ' (removed)' : ''}]`,
    payload: {
      contentType: 'reaction', reactTo: r.reference, emoji: r.content, content: r.content,
      schema: schemaStr, action: actionStr, removed,
      optionIndex: schemaStr === 'custom' ? Number(r.content) : undefined,
    },
  };
}

type RemoteAtt = {
  url: string; filename?: string; contentDigest?: string; nonce?: Uint8Array;
  salt?: Uint8Array; secret?: Uint8Array; scheme?: string; contentLength?: number;
};
const b64 = (u?: Uint8Array): string | undefined => u ? Buffer.from(u).toString('base64') : undefined;
function remoteAtt(r: RemoteAtt, kind: string): Record<string, unknown> {
  return {
    kind, url: r.url, name: r.filename, size: r.contentLength,
    remote: {
      contentDigest: r.contentDigest, nonce: b64(r.nonce), salt: b64(r.salt),
      secret: b64(r.secret), scheme: r.scheme,
    },
  };
}
const IMG_RE = /\.(png|jpg|jpeg|gif|webp|heic)(\?|$)/i;
const VID_RE = /\.(mp4|mov|webm|m4v)(\?|$)/i;

function multiRemotePayload(base: Record<string, unknown>, typeId: string, c: object): Record<string, unknown> {
  const m = c as { attachments?: RemoteAtt[] };
  const list = Array.isArray(m.attachments) ? m.attachments : [];
  const attachments = list.map(r => {
    const isImg = IMG_RE.test(r.url) || IMG_RE.test(r.filename ?? '');
    const isVid = VID_RE.test(r.url) || VID_RE.test(r.filename ?? '');
    return remoteAtt(r, isImg ? 'image' : isVid ? 'video' : 'file');
  });
  const imgCount = attachments.filter(a => a.kind === 'image').length;
  const vidCount = attachments.filter(a => a.kind === 'video').length;
  const one = attachments[0];
  const text = imgCount === attachments.length && imgCount > 1 ? `📷 ${imgCount} photos`
    : vidCount === attachments.length && vidCount > 1 ? `🎥 ${vidCount} videos`
      : attachments.length === 1
        ? (one!.kind === 'video' ? `🎥 ${one!.name ?? 'video'}` : `[${one!.kind}: ${one!.name ?? one!.url}]`)
        : `📎 ${attachments.length} attachments`;
  return { ...base, text, payload: { contentType: typeId, attachments } };
}

export function envelope(
  accountId: string, msg: DecodedMessage, conv: Conversation,
): Record<string, unknown> {
  const typeId = msg.contentType?.typeId;
  const c = msg.content;
  const line = lineOf(accountId, conv.id);
  const base = {
    id: mintId(), ts: msg.sentAt.toISOString(), station: 'xmtp', line,
    from: `metro://xmtp/${accountId}/user/${msg.senderInboxId}`, message_id: msg.id,
  };
  rememberUid(base.id, msg.id);
  if (typeof c === 'string') return { ...base, text: c, payload: { contentType: typeId } };
  if (typeId === 'reaction' && c && typeof c === 'object') return reactionPayload(base, c as Reaction);
  if (typeId === 'reply' && c && typeof c === 'object') {
    const r = c as Reply;
    return {
      ...base, text: typeof r.content === 'string' ? r.content
        : `[reply with ${r.contentType?.typeId ?? 'unknown'}]`,
      payload: { contentType: typeId, replyTo: r.reference, replyContentType: r.contentType?.typeId },
    };
  }
  if (typeId === 'attachment' && c && typeof c === 'object') {
    const a = c as { filename?: string; mimeType: string; content: Uint8Array };
    const kind = a.mimeType?.startsWith('image/') ? 'image'
      : a.mimeType?.startsWith('audio/') ? 'audio'
        : a.mimeType?.startsWith('video/') ? 'video' : 'file';
    const dataB64 = Buffer.from(a.content).toString('base64');
    const out = {
      ...base, text: `[${kind}: ${a.filename ?? 'attachment'}]`,
      payload: { contentType: typeId, attachments: [{ kind, mime: a.mimeType, name: a.filename, dataB64 }] },
    };
    if (kind === 'audio') void transcribeAndEmit(a.content, line, accountId, base.id);
    return out;
  }
  if (typeId === 'remoteStaticAttachment' && c && typeof c === 'object') {
    const r = c as RemoteAtt;
    const kind = IMG_RE.test(r.url) ? 'image' : 'file';
    return { ...base, text: `[${kind}: ${r.filename ?? r.url}]`,
      payload: { contentType: typeId, attachments: [remoteAtt(r, kind)] } };
  }
  if ((typeId === 'multiRemoteStaticAttachment' || typeId === 'multiRemoteAttachment')
    && c && typeof c === 'object') {
    return multiRemotePayload(base, typeId, c);
  }
  if (typeId === 'poll' && c && typeof c === 'object') {
    const p = c as { question?: string };
    return { ...base, text: `Poll: ${p.question ?? ''}`, payload: { contentType: typeId, poll: c } };
  }
  if (typeId === 'walletSendCalls' && c && typeof c === 'object') {
    return { ...base, text: 'Payment request',
      payload: { contentType: typeId, walletSendCalls: c as WalletSendCallsParams } };
  }
  if (typeId === 'transactionReference' && c && typeof c === 'object') {
    return { ...base, text: 'Transaction',
      payload: { contentType: typeId, transactionReference: c as TransactionReference } };
  }
  if (typeId === 'signatureRequest' && c && typeof c === 'object') {
    return { ...base, text: 'Signature request', payload: { contentType: typeId, signatureRequest: c } };
  }
  if (typeId === 'signatureReference' && c && typeof c === 'object') {
    return { ...base, text: 'Signature', payload: { contentType: typeId, signatureReference: c } };
  }
  return { ...base, text: `[${typeId ?? 'unknown'} payload]`, payload: { contentType: typeId } };
}

export function emitOutbound(accountId: string, line: string, messageId: string, text: string): void {
  const uid = mintId();
  rememberUid(uid, messageId);
  emit({
    kind: 'outbound', id: uid, ts: new Date().toISOString(), station: 'xmtp',
    line, from: SELF_URI, to: line, message_id: messageId, text, account: accountId,
    payload: { account: accountId },
  });
  const preview0 = humanizePushPreview(text);
  const preview = preview0.length > 140 ? `${preview0.slice(0, 137)}…` : preview0;
  // Notify the recipient device(s), titled with the SENDER's resolved profile name.
  void (async (): Promise<void> => {
    const addr = accounts.get(accountId)?.address ?? '';
    const name = addr ? await resolveProfileName(addr) : '';
    const title = name || (addr ? shortAddr(addr) : 'New message');
    const data: Record<string, string> = { line, messageId };
    { const p = parseLine(line); if (p) data.convId = p.convId; }
    if (addr) data.avatarUrl = `https://stamp.fyi/avatar/eth:${addr}?s=128`;
    await fcmPushToAll(accountId, title, preview, data);
  })().catch(() => undefined);
}
