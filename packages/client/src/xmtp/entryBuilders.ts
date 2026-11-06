import type { HistoryEntry } from '../types';
import { attachmentKindOf, humanizeGroupUpdated, LEFT_CHANNEL_TEXT, type GroupUpdatedContent } from './humanize';
import { type FrameActionContent, frameActionText } from './frame';
import { DELETE_MESSAGE_TYPE_ID, deleteTargetOfContent, deletedByOfContent } from './deleteMessage';
import { objectOf, type CanonicalAttachment, type CanonicalReaction, type CanonicalReply } from './message';

export type EntryBuilder = (base: HistoryEntry, typeId: string, decoded: unknown, fallback?: string) => HistoryEntry;

export function safe<T>(fn: () => T): T | undefined {
  try {
    return fn();
  } catch {
    return undefined;
  }
}

export const reactionEntry: EntryBuilder = (base, typeId, decoded) => {
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
};

export function validRemoteAttachment(value: unknown): Record<string, unknown> | undefined {
  const remote = objectOf(value);
  if (remote === undefined || typeof remote.url !== 'string' || typeof remote.contentDigest !== 'string') return undefined;
  return ['secret', 'salt', 'nonce'].every((key) => typeof remote[key] === 'string' || remote[key] instanceof Uint8Array)
    ? remote
    : undefined;
}

interface MultiRemoteAttachmentView {
  attachments?: ({ filename?: string } & Record<string, unknown>)[];
}

export const multiRemoteEntry: EntryBuilder = (base, typeId, decoded) => {
  const m = decoded as MultiRemoteAttachmentView;
  const attachments = (m.attachments ?? []).map((info, i) => {
    const name = info.filename ?? `attachment-${i + 1}`;
    return { kind: attachmentKindOf({ filename: name }), name, remote: info };
  });
  const first = attachments[0];
  const summary =
    first !== undefined && attachments.length === 1 ? `[${first.kind}: ${first.name}]` : `[${attachments.length} attachments]`;
  return { ...base, text: summary, payload: { contentType: typeId, attachments } };
};

export const replyEntry: EntryBuilder = (base, typeId, decoded, fallback) => {
  const reply = decoded as CanonicalReply;
  const reference = reply.reference;
  const remote = validRemoteAttachment(reply.remote);
  const nested = remote === undefined ? undefined : safe(() => multiRemoteEntry(base, typeId, { attachments: [remote] }));
  return {
    ...base,
    text: nested?.text ?? reply.text ?? fallback ?? '[reply]',
    replyTo: reference,
    payload: { ...objectOf(nested?.payload), contentType: typeId, replyTo: reference },
  };
};

export const attachmentEntry: EntryBuilder = (base, typeId, decoded) => {
  const a = decoded as CanonicalAttachment;
  const kind = attachmentKindOf({ mimeType: a.mimeType });
  return {
    ...base,
    text: `[${kind}: ${a.filename ?? 'attachment'}]`,
    payload: { contentType: typeId, attachments: [{ kind, mime: a.mimeType, name: a.filename, dataB64: a.dataB64 }] },
  };
};

export const deleteRequestEntry: EntryBuilder = (base, _typeId, decoded) => ({
  ...base,
  payload: { contentType: DELETE_MESSAGE_TYPE_ID, deletes: deleteTargetOfContent(decoded) },
});

export const deletedEntry: EntryBuilder = (base, typeId, decoded) => ({
  ...base,
  payload: { contentType: typeId, deletedBy: deletedByOfContent(decoded) },
});

export function callEntry(key: 'callInvite' | 'callSignal', parse: (decoded: unknown) => unknown): EntryBuilder {
  return (base, typeId, decoded, fallback) => {
    const content = parse(decoded);
    return {
      ...base,
      text: fallback ?? `[${typeId} payload]`,
      payload: content === null ? { contentType: typeId } : { contentType: typeId, [key]: content },
    };
  };
}

export function contentEntry(key: string, textOf: (content: never) => string): EntryBuilder {
  return (base, typeId, decoded) => ({ ...base, text: textOf(decoded as never), payload: { contentType: typeId, [key]: decoded } });
}

export const frameActionEntry: EntryBuilder = (base, typeId, decoded) => {
  const content = decoded as FrameActionContent;
  return { ...base, text: frameActionText(content), replyTo: content.frameId, payload: { contentType: typeId, frameAction: content } };
};

export const groupUpdateEntry: EntryBuilder = (base, typeId, decoded) => ({
  ...base,
  text: humanizeGroupUpdated(decoded as GroupUpdatedContent),
  payload: { contentType: typeId, system: true, groupUpdate: decoded as GroupUpdatedContent },
});

export const leaveEntry: EntryBuilder = (base, typeId) => ({
  ...base,
  text: LEFT_CHANNEL_TEXT,
  payload: { contentType: typeId, system: true },
});
