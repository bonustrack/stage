import type { HistoryEntry } from '../types';
import { attachmentKindOf, humanizeGroupUpdated, LEFT_CHANNEL_TEXT, type GroupUpdatedContent } from './humanize';
import { type FrameActionContent, frameActionText } from './frame';
import { DELETE_MESSAGE_TYPE_ID, deleteTargetOfContent, deletedByOfContent } from './deleteMessage';
import { objectOf, stringOf, type CanonicalAttachment, type CanonicalReaction, type CanonicalReply } from './message';
import { z } from 'zod';
import type { OutputSchema } from '../validate';
import {
  attachmentSummaryOf,
  structuredPayload,
  type EntryAttachment,
  type RemoteAttachmentRef,
  type StructuredType,
} from './entryPayload';

export type EntryBuilder = (base: HistoryEntry, typeId: string, decoded: unknown, fallback?: string) => HistoryEntry;

export function safe<T>(fn: () => T): T | undefined {
  try {
    return fn();
  } catch {
    return undefined;
  }
}

export const reactionEntry: EntryBuilder = (base, typeId, decoded) => {
  const { reference: reactTo, content: emoji, removed, custom } = decoded as CanonicalReaction;
  return {
    ...base,
    text: `[${custom ? 'vote' : 'react'} ${emoji}${removed ? ' (removed)' : ''}]`,
    payload: { contentType: typeId, reactTo, emoji, ...(custom ? { schema: 'custom' as const } : {}), removed },
  };
};

const attachmentKey = z.union([z.string(), z.instanceof(Uint8Array)]);

const remoteAttachmentSchema: OutputSchema<RemoteAttachmentRef> = z
  .object({
    url: z.string(),
    contentDigest: z.string(),
    secret: attachmentKey,
    salt: attachmentKey,
    nonce: attachmentKey,
    scheme: z.string().nullish(),
    contentLength: z.union([z.number(), z.string(), z.bigint()]).nullish(),
    filename: z.string().nullish(),
  })
  .transform(({ scheme, contentLength, filename, ...keys }) => ({
    ...keys,
    scheme: scheme ?? undefined,
    contentLength: typeof contentLength === 'bigint' ? Number(contentLength) : (contentLength ?? undefined),
    filename: filename ?? undefined,
  }));

export function validRemoteAttachment(value: unknown): RemoteAttachmentRef | undefined {
  const parsed = remoteAttachmentSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

export const multiRemoteEntry: EntryBuilder = (base, typeId, decoded) => {
  const items = objectOf(decoded)?.attachments;
  const attachments = (Array.isArray(items) ? (items as unknown[]) : []).map((item, i): EntryAttachment => {
    const name = stringOf(objectOf(item)?.filename) ?? `attachment-${i + 1}`;
    return { kind: attachmentKindOf({ filename: name }), name, remote: validRemoteAttachment(item) };
  });
  return { ...base, text: attachmentSummaryOf(attachments), payload: { contentType: typeId, attachments } };
};

export const replyEntry: EntryBuilder = (base, typeId, decoded, fallback) => {
  const reply = decoded as CanonicalReply;
  const remote = validRemoteAttachment(reply.remote);
  const nested = remote === undefined ? undefined : safe(() => multiRemoteEntry(base, typeId, { attachments: [remote] }));
  return {
    ...base,
    text: nested?.text ?? reply.text ?? fallback ?? '[reply]',
    replyTo: reply.reference,
    payload: { ...objectOf(nested?.payload), contentType: typeId, replyTo: reply.reference },
  };
};

export const attachmentEntry: EntryBuilder = (base, typeId, decoded) => {
  const a = decoded as CanonicalAttachment;
  const attachments = [{ kind: attachmentKindOf({ mimeType: a.mimeType }), mime: a.mimeType, name: a.filename, dataB64: a.dataB64 }];
  return { ...base, text: attachmentSummaryOf(attachments), payload: { contentType: typeId, attachments } };
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

export function structuredEntry(type: StructuredType, textOf: (content: never) => string): EntryBuilder {
  return (base, _typeId, decoded) => ({ ...base, text: textOf(decoded as never), payload: structuredPayload(type, decoded as never) });
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
