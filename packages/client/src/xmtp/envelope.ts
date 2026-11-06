import type { HistoryEntry } from '../types';
import {
  attachmentKindOf,
  humanizeGroupUpdated,
  isGroupUpdateTypeId,
  LEAVE_REQUEST_TYPE_ID,
  LEFT_CHANNEL_TEXT,
  type GroupUpdatedContent,
} from './humanize';
import { pollFallbackText } from './poll';
import { signatureRequestFallbackText, signatureReferenceFallbackText } from './sign';
import { walletSendCallsFallbackText, transactionReferenceFallbackText } from './tx';
import { type FrameActionContent, frameActionText, frameFallbackText } from './frame';
import { userUriOf } from './line';
import { parseCallInvite, parseCallSignal } from './call';
import {
  DELETED_MESSAGE_TYPE_ID,
  DELETE_MESSAGE_TYPE_ID,
  STAGE_DELETE_TYPE_ID,
  deleteTargetOfContent,
  deletedByOfContent,
} from './deleteMessage';
import { objectOf, type CanonicalAttachment, type CanonicalReaction, type CanonicalReply, type XmtpMessage } from './message';

function reactionEnvelope(base: HistoryEntry, typeId: string, decoded: unknown): HistoryEntry {
  const r = decoded as CanonicalReaction;
  const removed = r.removed;
  if (r.custom) {
    return {
      ...base,
      text: `[vote ${r.content}${removed ? ' (removed)' : ''}]`,
      payload: { contentType: typeId, reactTo: r.reference, emoji: r.content, schema: 'custom', removed },
    };
  }
  return {
    ...base,
    text: `[react ${r.content}${removed ? ' (removed)' : ''}]`,
    payload: { contentType: typeId, reactTo: r.reference, emoji: r.content, removed },
  };
}

function safe<T>(fn: () => T): T | undefined {
  try {
    return fn();
  } catch {
    return undefined;
  }
}

export function validRemoteAttachment(value: unknown): Record<string, unknown> | undefined {
  const remote = objectOf(value);
  if (remote === undefined || typeof remote.url !== 'string' || typeof remote.contentDigest !== 'string') return undefined;
  return ['secret', 'salt', 'nonce'].every((key) => typeof remote[key] === 'string' || remote[key] instanceof Uint8Array)
    ? remote
    : undefined;
}

function replyEnvelope(base: HistoryEntry, typeId: string, decoded: unknown, fallback?: string): HistoryEntry {
  const reply = decoded as CanonicalReply;
  const reference = reply.reference;
  const remote = validRemoteAttachment(reply.remote);
  const nested = remote === undefined ? undefined : safe(() => multiRemoteEnvelope(base, typeId, { attachments: [remote] }));
  return {
    ...base,
    text: nested?.text ?? reply.text ?? fallback ?? '[reply]',
    replyTo: reference,
    payload: { ...nested?.payload, contentType: typeId, replyTo: reference },
  };
}

function attachmentEnvelope(base: HistoryEntry, typeId: string, decoded: unknown): HistoryEntry {
  const a = decoded as CanonicalAttachment;
  const kind = attachmentKindOf({ mimeType: a.mimeType });
  return {
    ...base,
    text: `[${kind}: ${a.filename ?? 'attachment'}]`,
    payload: { contentType: typeId, attachments: [{ kind, mime: a.mimeType, name: a.filename, dataB64: a.dataB64 }] },
  };
}

interface MultiRemoteAttachmentView {
  attachments?: ({ filename?: string } & Record<string, unknown>)[];
}

function multiRemoteEnvelope(base: HistoryEntry, typeId: string, decoded: unknown): HistoryEntry & { payload: Record<string, unknown> } {
  const m = decoded as MultiRemoteAttachmentView;
  const attachments = (m.attachments ?? []).map((info, i) => {
    const name = info.filename ?? `attachment-${i + 1}`;
    return { kind: attachmentKindOf({ filename: name }), name, remote: info };
  });
  const first = attachments[0];
  const summary =
    first !== undefined && attachments.length === 1 ? `[${first.kind}: ${first.name}]` : `[${attachments.length} attachments]`;
  return { ...base, text: summary, payload: { contentType: typeId, attachments } };
}

type Handler = (base: HistoryEntry, typeId: string, decoded: unknown, fallback?: string) => HistoryEntry;

const deleteRequestEnvelope: Handler = (base, _typeId, decoded) => ({
  ...base,
  payload: { contentType: DELETE_MESSAGE_TYPE_ID, deletes: deleteTargetOfContent(decoded) },
});

function callEnvelope(key: 'callInvite' | 'callSignal', parse: (decoded: unknown) => unknown): Handler {
  return (base, typeId, decoded, fallback) => {
    const content = parse(decoded);
    return {
      ...base,
      text: fallback ?? `[${typeId} payload]`,
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
    return { ...base, text: frameActionText(content), replyTo: content.frameId, payload: { contentType: typeId, frameAction: content } };
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
    ...base,
    payload: { contentType: typeId, deletedBy: deletedByOfContent(decoded) },
  }),
};

function leaveEnvelope(base: HistoryEntry, typeId: string): HistoryEntry {
  return { ...base, text: LEFT_CHANNEL_TEXT, payload: { contentType: typeId, system: true } };
}

export function isSystemEntry(entry: HistoryEntry): boolean {
  return (entry.payload as { system?: boolean } | undefined)?.system === true;
}

function handledEnvelope(base: HistoryEntry, typeId: string, decoded: unknown, fallback: string | undefined): HistoryEntry | undefined {
  const handler = Object.hasOwn(ENVELOPE_HANDLERS, typeId) ? ENVELOPE_HANDLERS[typeId] : undefined;
  if (objectOf(decoded) !== undefined && handler) {
    const built = safe(() => handler(base, typeId, decoded, fallback));
    if (built) return built;
  }
  if (isGroupUpdateTypeId(typeId)) {
    return safe(() => ({
      ...base,
      text: humanizeGroupUpdated(decoded as GroupUpdatedContent),
      payload: { contentType: typeId, system: true, groupUpdate: decoded as GroupUpdatedContent } as const,
    }));
  }
  return undefined;
}

function contentEnvelopeOf(base: HistoryEntry, typeId: string, decoded: unknown, fallback: string | undefined): HistoryEntry {
  if (typeof decoded === 'string') return { ...base, text: decoded, payload: { contentType: typeId } };
  return (
    handledEnvelope(base, typeId, decoded, fallback) ?? {
      ...base,
      text: fallback ?? `[${typeId} payload]`,
      payload: { contentType: typeId },
    }
  );
}

export function envelopeOf(message: XmtpMessage, line: string): HistoryEntry {
  const base: HistoryEntry = {
    id: message.id,
    ts: new Date(message.sentMs).toISOString(),
    station: 'xmtp',
    line,
    from: userUriOf(message.senderInboxId),
    to: line,
    messageId: message.id,
  };
  const typeId = message.contentTypeId;
  if (typeId === LEAVE_REQUEST_TYPE_ID) return leaveEnvelope(base, typeId);
  if (message.undecodable === true) return { ...base, text: `[${typeId} payload]`, payload: { contentType: typeId } };
  return contentEnvelopeOf(base, typeId, message.content, message.fallback);
}
