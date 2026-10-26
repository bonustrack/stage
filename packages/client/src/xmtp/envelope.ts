import type { HistoryEntry } from '../types';
import {
  attachmentKindOf, humanizeGroupUpdated, isGroupUpdateTypeId, LEAVE_REQUEST_TYPE_ID, LEFT_CHANNEL_TEXT,
  type GroupUpdatedContent,
} from './humanize';
import { pollFallbackText } from './poll';
import { signatureRequestFallbackText, signatureReferenceFallbackText } from './sign';
import { walletSendCallsFallbackText, transactionReferenceFallbackText } from './tx';
import { type FrameActionContent, frameActionText, frameFallbackText } from './frame';
import { XMTP_USER_PREFIX } from './line';
import { parseCallInvite, parseCallSignal } from './call';
import {
  DELETED_MESSAGE_TYPE_ID, DELETE_MESSAGE_TYPE_ID, STAGE_DELETE_TYPE_ID, deleteTargetOfContent, deletedByOfContent,
  shortTypeId,
} from './deleteMessage';

export interface DecodedMessageView {
  id: string;
  senderInboxId: string;
  sentNs: number;
  contentTypeId: string;
  content(): unknown;
  fallback?: string;
}

interface ReactionContentView {
  reference: string;
  action: string;
  content: string;
  schema: string;
}
interface ReplyContentView { reference: string; content?: { text?: string } }
interface StaticAttachmentView { filename: string; mimeType?: string; data: string }
interface MultiRemoteAttachmentView {
  attachments?: ({ filename?: string } & Record<string, unknown>)[];
}

export interface EnvelopeOptions {
  reactionRemoved(action: unknown): boolean;
  reactionCustom(schema: unknown): boolean;
  reactionCustomPayloadExtras: boolean;
  replyReferenceOf(decoded: unknown): string;
  replyTextOf(decoded: unknown): string | undefined;
  attachmentNameOf(decoded: unknown): string | undefined;
  attachmentLabelOf(decoded: unknown): string;
  attachmentDataB64Of(decoded: unknown): string;
  requireObjectForHandlers: boolean;
}

const defaultEnvelopeOptions: EnvelopeOptions = {
  reactionRemoved: (action) => action === 'removed',
  reactionCustom: (schema) => schema === 'custom',
  reactionCustomPayloadExtras: true,
  replyReferenceOf: (decoded) => (decoded as ReplyContentView).reference,
  replyTextOf: (decoded) => (decoded as ReplyContentView).content?.text,
  attachmentNameOf: (decoded) => (decoded as StaticAttachmentView).filename,
  attachmentLabelOf: (decoded) => (decoded as StaticAttachmentView).filename,
  attachmentDataB64Of: (decoded) => (decoded as StaticAttachmentView).data,
  requireObjectForHandlers: false,
};

function reactionEnvelope(base: HistoryEntry, typeId: string, decoded: unknown, opts: EnvelopeOptions): HistoryEntry {
  const r = decoded as ReactionContentView;
  const removed = opts.reactionRemoved(r.action);
  if (opts.reactionCustom(r.schema)) {
    const extras = opts.reactionCustomPayloadExtras
      ? { voteFor: r.reference, optionIndex: Number(r.content) }
      : {};
    return {
      ...base,
      text: `[vote ${r.content}${removed ? ' (removed)' : ''}]`,
      payload: {
        contentType: typeId, reactTo: r.reference, emoji: r.content,
        schema: 'custom', ...extras, removed,
      },
    };
  }
  return {
    ...base,
    text: `[react ${r.content}${removed ? ' (removed)' : ''}]`,
    payload: { contentType: typeId, reactTo: r.reference, emoji: r.content, removed },
  };
}

function safe<T>(fn: () => T): T | undefined {
  try { return fn(); } catch { return undefined; }
}

function objectOf(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : undefined;
}

export function remoteAttachmentOfReply(decoded: unknown): Record<string, unknown> | undefined {
  const content = objectOf(objectOf(decoded)?.content);
  const remote = objectOf(content?.remoteAttachment) ?? content;
  if (remote === undefined || typeof remote.url !== 'string' || typeof remote.contentDigest !== 'string') return undefined;
  return ['secret', 'salt', 'nonce'].every(key => typeof remote[key] === 'string' || remote[key] instanceof Uint8Array) ? remote : undefined;
}

function replyEnvelope(
  base: HistoryEntry, typeId: string, decoded: unknown, opts: EnvelopeOptions, fallback?: string,
): HistoryEntry {
  const reference = safe(() => opts.replyReferenceOf(decoded)) ?? '';
  const remote = remoteAttachmentOfReply(decoded);
  const nested = remote === undefined ? undefined : safe(() => multiRemoteEnvelope(base, typeId, { attachments: [remote] }));
  return {
    ...base,
    text: nested?.text ?? safe(() => opts.replyTextOf(decoded)) ?? fallback ?? '[reply]',
    replyTo: reference,
    payload: { ...nested?.payload, contentType: typeId, replyTo: reference },
  };
}

function attachmentEnvelope(base: HistoryEntry, typeId: string, decoded: unknown, opts: EnvelopeOptions): HistoryEntry {
  const a = decoded as StaticAttachmentView;
  const kind = attachmentKindOf({ mimeType: a.mimeType });
  return {
    ...base,
    text: `[${kind}: ${opts.attachmentLabelOf(decoded)}]`,
    payload: {
      contentType: typeId,
      attachments: [{
        kind, mime: a.mimeType,
        name: opts.attachmentNameOf(decoded),
        dataB64: opts.attachmentDataB64Of(decoded),
      }],
    },
  };
}

function multiRemoteEnvelope(base: HistoryEntry, typeId: string, decoded: unknown): HistoryEntry & { payload: Record<string, unknown> } {
  const m = decoded as MultiRemoteAttachmentView;
  const attachments = (m.attachments ?? []).map((info, i) => {
    const name = info.filename ?? `attachment-${i + 1}`;
    return { kind: attachmentKindOf({ filename: name }), name, remote: info };
  });
  const first = attachments[0];
  const summary = first !== undefined && attachments.length === 1
    ? `[${first.kind}: ${first.name}]`
    : `[${attachments.length} attachments]`;
  return { ...base, text: summary, payload: { contentType: typeId, attachments } };
}

type Handler = (
  base: HistoryEntry, typeId: string, decoded: unknown, opts: EnvelopeOptions, fallback?: string,
) => HistoryEntry;

const deleteRequestEnvelope: Handler = (base, _typeId, decoded) => ({
  ...base, payload: { contentType: DELETE_MESSAGE_TYPE_ID, deletes: deleteTargetOfContent(decoded) },
});

function callEnvelope(key: 'callInvite' | 'callSignal', parse: (decoded: unknown) => unknown): Handler {
  return (base, typeId, decoded, _opts, fallback) => {
    const content = parse(decoded);
    return {
      ...base, text: fallback ?? `[${typeId} payload]`,
      payload: content === null ? { contentType: typeId } : { contentType: typeId, [key]: content },
    };
  };
}

function contentEnvelope(key: string, textOf: (content: never) => string): Handler {
  return (base, typeId, decoded) => ({ ...base, text: textOf(decoded as never), payload: { contentType: typeId, [key]: decoded } });
}

const ENVELOPE_HANDLERS: Record<string, Handler> = {
  reaction: reactionEnvelope,
  poll: contentEnvelope('poll', pollFallbackText),
  signatureRequest: contentEnvelope('signatureRequest', signatureRequestFallbackText),
  signatureReference: contentEnvelope('signatureReference', signatureReferenceFallbackText),
  walletSendCalls: contentEnvelope('walletSendCalls', walletSendCallsFallbackText),
  transactionReference: contentEnvelope('txReference', transactionReferenceFallbackText),
  frame: contentEnvelope('frame', frameFallbackText),
  frameAction: (base, typeId, decoded) => {
    const content = decoded as FrameActionContent;
    return {
      ...base, text: frameActionText(content), replyTo: content.frameId,
      payload: { contentType: typeId, frameAction: content },
    };
  },
  callInvite: callEnvelope('callInvite', parseCallInvite),
  callSignal: callEnvelope('callSignal', parseCallSignal),
  reply: replyEnvelope,
  attachment: attachmentEnvelope,
  multiRemoteStaticAttachment: multiRemoteEnvelope,
  multiRemoteAttachment: multiRemoteEnvelope,
  [DELETE_MESSAGE_TYPE_ID]: deleteRequestEnvelope,
  [STAGE_DELETE_TYPE_ID]: deleteRequestEnvelope,
  [DELETED_MESSAGE_TYPE_ID]: (base, typeId, decoded) => ({
    ...base, payload: { contentType: typeId, deletedBy: deletedByOfContent(decoded) },
  }),
};

function leaveEnvelope(base: HistoryEntry, typeId: string): HistoryEntry {
  return { ...base, text: LEFT_CHANNEL_TEXT, payload: { contentType: typeId, system: true } };
}

export function isSystemEntry(entry: HistoryEntry): boolean {
  return (entry.payload as { system?: boolean } | undefined)?.system === true;
}

function handledEnvelope(
  base: HistoryEntry, typeId: string, decoded: unknown, fallback: string | undefined, options: EnvelopeOptions,
): HistoryEntry | undefined {
  const objectOk = !options.requireObjectForHandlers || (decoded !== null && typeof decoded === 'object');
  const handler = Object.hasOwn(ENVELOPE_HANDLERS, typeId) ? ENVELOPE_HANDLERS[typeId] : undefined;
  if (objectOk && handler) {
    const built = safe(() => handler(base, typeId, decoded, options, fallback));
    if (built) return built;
  }
  if (isGroupUpdateTypeId(typeId)) {
    return safe(() => ({
      ...base, text: humanizeGroupUpdated(decoded as GroupUpdatedContent),
      payload: { contentType: typeId, system: true, groupUpdate: decoded as GroupUpdatedContent } as const,
    }));
  }
  return undefined;
}

export function envelopeFromContent(
  base: HistoryEntry,
  typeId: string,
  decoded: unknown,
  fallback: string | undefined,
  options: EnvelopeOptions = defaultEnvelopeOptions,
): HistoryEntry {
  if (typeId === LEAVE_REQUEST_TYPE_ID) return leaveEnvelope(base, typeId);
  if (typeof decoded === 'string') {
    return { ...base, text: decoded, payload: { contentType: typeId } };
  }
  return handledEnvelope(base, typeId, decoded, fallback, options)
    ?? { ...base, text: fallback ?? `[${typeId} payload]`, payload: { contentType: typeId } };
}

export function mapDecodedToEnvelope(msg: DecodedMessageView, line: string): HistoryEntry {
  const ts = new Date(Math.floor(msg.sentNs / 1_000_000)).toISOString();
  const base: HistoryEntry = {
    id: msg.id, ts, station: 'xmtp', line,
    from: `${XMTP_USER_PREFIX}${msg.senderInboxId}`, to: line, messageId: msg.id,
  };
  const typeId = shortTypeId(msg.contentTypeId);
  if (typeId === LEAVE_REQUEST_TYPE_ID) return leaveEnvelope(base, typeId);
  let decoded: unknown;
  try { decoded = msg.content(); }
  catch { return { ...base, text: `[${typeId} payload]`, payload: { contentType: typeId } }; }

  return envelopeFromContent(base, typeId, decoded, msg.fallback);
}
