import { humanizeMentions, LEFT_CHANNEL_TEXT } from './humanize';
import { pollFallbackText } from './poll';
import { signatureRequestFallbackText, signatureReferenceFallbackText } from './sign';
import { walletSendCallsFallbackText, transactionReferenceFallbackText } from './tx';
import { frameFallbackText } from './frame';
import { callPreviewText, parseCallInvite, parseCallSignal } from './call';
import { DELETED_MESSAGE_TEXT, DELETE_MESSAGE_CODEC, type EncodedDeleteMessage } from './deleteMessage';
import type { EncodedJsonContent, XmtpContentTypeId } from './codecs';
import {
  CALL_INVITE_CODEC,
  CALL_SIGNAL_CODEC,
  DELETE_REQUEST_CODEC,
  FRAME_ACTION_CODEC,
  FRAME_CODEC,
  POLL_CODEC,
  SIGNATURE_REFERENCE_CODEC,
  SIGNATURE_REQUEST_CODEC,
  TRANSACTION_REFERENCE_CODEC,
  WALLET_SEND_CALLS_CODEC,
} from './jsonCodecs';
import { SYNC_KINDS } from './sync/registry';
import {
  attachmentEntry,
  callEntry,
  structuredEntry,
  deletedEntry,
  deleteRequestEntry,
  frameActionEntry,
  groupUpdateEntry,
  leaveEntry,
  multiRemoteEntry,
  reactionEntry,
  replyEntry,
  validRemoteAttachment,
  type EntryBuilder,
} from './entryBuilders';
import {
  fixedPreview,
  previewDeleted,
  previewFrame,
  previewFrameAction,
  previewGroupUpdate,
  previewMultiRemote,
  previewPaymentRequest,
  previewPoll,
  previewReaction,
  previewReceipt,
  previewReply,
  previewSingleAttachment,
  type PreviewOf,
} from './previews';
import { objectOf, stringOf } from './message';
import type { RemoteAttachmentRef } from './entryPayload';
import { shortTypeId } from './typeId';

export type RowRole = 'bubble' | 'system' | 'silent' | 'hidden';

export type CodecPlatform = 'native' | 'web';

export interface AttachedFile {
  name?: string;
  size?: unknown;
  mime?: string;
  dataB64?: string;
  remote?: RemoteAttachmentRef;
}

export interface StageCodec {
  contentType: XmtpContentTypeId;
  encode(content: never): EncodedJsonContent | EncodedDeleteMessage;
  decode(encoded: { content: Uint8Array }): unknown;
  fallback(content: never): string | undefined;
  shouldPush(): boolean;
}

interface ContentTypeSpec {
  role: RowRole;
  deletable?: true;
  codec?: StageCodec;
  codecOnlyOn?: CodecPlatform;
  entry?: EntryBuilder;
  entryIgnoresContent?: true;
  preview?: PreviewOf;
  files?: (content: Record<string, unknown>) => AttachedFile[];
}

function base64ByteLength(data: string): number {
  const padding = data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((data.length * 3) / 4) - padding);
}

function remoteFile(item: Record<string, unknown>): AttachedFile {
  return { name: stringOf(item.filename), size: item.contentLength, remote: validRemoteAttachment(item) };
}

const inlineFiles = (content: Record<string, unknown>): AttachedFile[] => {
  const data = stringOf(content.dataB64);
  return [
    {
      name: stringOf(content.filename),
      size: data === undefined ? Number.NaN : base64ByteLength(data),
      mime: stringOf(content.mimeType),
      dataB64: data,
    },
  ];
};

const multiRemoteFiles = (content: Record<string, unknown>): AttachedFile[] =>
  (Array.isArray(content.attachments) ? (content.attachments as unknown[]) : []).map((item) => remoteFile(objectOf(item) ?? {}));

const replyFiles = (content: Record<string, unknown>): AttachedFile[] => {
  const file = remoteFile(objectOf(content.remote) ?? {});
  return file.remote === undefined ? [] : [file];
};

const deletionPreview = fixedPreview(DELETED_MESSAGE_TEXT);

const SYNC_TYPES: Record<string, ContentTypeSpec> = Object.fromEntries(
  Object.values(SYNC_KINDS).map((kind) => [kind.contentType.typeId, { role: 'hidden', codec: kind }]),
);

const MULTI_REMOTE: ContentTypeSpec = { role: 'bubble', entry: multiRemoteEntry, preview: previewMultiRemote, files: multiRemoteFiles };

const CONTENT_TYPES: Readonly<Record<string, ContentTypeSpec>> = {
  text: { role: 'bubble', deletable: true },
  markdown: { role: 'bubble', deletable: true },
  reply: { role: 'bubble', deletable: true, entry: replyEntry, preview: previewReply, files: replyFiles },
  reaction: { role: 'silent', entry: reactionEntry, preview: previewReaction },
  readReceipt: { role: 'silent' },
  attachment: { role: 'bubble', deletable: true, entry: attachmentEntry, preview: previewSingleAttachment, files: inlineFiles },
  remoteStaticAttachment: {
    role: 'bubble',
    deletable: true,
    preview: previewSingleAttachment,
    files: (content: Record<string, unknown>) => [remoteFile(content)],
  },
  multiRemoteStaticAttachment: { ...MULTI_REMOTE, deletable: true },
  multiRemoteAttachment: MULTI_REMOTE,
  group_updated: { role: 'system', entry: groupUpdateEntry, preview: previewGroupUpdate },
  leave_request: { role: 'system', entry: leaveEntry, entryIgnoresContent: true, preview: fixedPreview(LEFT_CHANNEL_TEXT) },
  deletedMessage: { role: 'bubble', entry: deletedEntry, preview: previewDeleted },
  poll: { role: 'bubble', codec: POLL_CODEC, entry: structuredEntry('poll', pollFallbackText), preview: previewPoll },
  signatureRequest: {
    role: 'bubble',
    codec: SIGNATURE_REQUEST_CODEC,
    entry: structuredEntry('signatureRequest', signatureRequestFallbackText),
    preview: fixedPreview('Signature request'),
  },
  signatureReference: {
    role: 'bubble',
    codec: SIGNATURE_REFERENCE_CODEC,
    entry: structuredEntry('signatureReference', signatureReferenceFallbackText),
    preview: fixedPreview('Signed'),
  },
  walletSendCalls: {
    role: 'bubble',
    deletable: true,
    codec: WALLET_SEND_CALLS_CODEC,
    entry: structuredEntry('walletSendCalls', walletSendCallsFallbackText),
    preview: previewPaymentRequest,
  },
  ...SYNC_TYPES,
  callInvite: { role: 'bubble', codec: CALL_INVITE_CODEC, entry: callEntry('callInvite', parseCallInvite), preview: callPreviewText },
  callSignal: { role: 'hidden', codec: CALL_SIGNAL_CODEC, entry: callEntry('callSignal', parseCallSignal), preview: callPreviewText },
  frame: { role: 'bubble', codec: FRAME_CODEC, entry: structuredEntry('frame', frameFallbackText), preview: previewFrame },
  frameAction: { role: 'bubble', codec: FRAME_ACTION_CODEC, entry: frameActionEntry, preview: previewFrameAction },
  deleteRequest: { role: 'hidden', codec: DELETE_REQUEST_CODEC, entry: deleteRequestEntry, preview: deletionPreview },
  transactionReference: {
    role: 'bubble',
    deletable: true,
    codec: TRANSACTION_REFERENCE_CODEC,
    codecOnlyOn: 'native',
    entry: structuredEntry('transactionReference', transactionReferenceFallbackText),
    preview: previewReceipt,
  },
  deleteMessage: { role: 'hidden', codec: DELETE_MESSAGE_CODEC, codecOnlyOn: 'web', entry: deleteRequestEntry, preview: deletionPreview },
};

const UNKNOWN_TYPE: ContentTypeSpec = { role: 'bubble' };

function specOf(contentTypeId: string | undefined | null): ContentTypeSpec {
  const typeId = shortTypeId(contentTypeId);
  return (Object.hasOwn(CONTENT_TYPES, typeId) ? CONTENT_TYPES[typeId] : undefined) ?? UNKNOWN_TYPE;
}

export function roleOfType(contentTypeId: string | undefined | null): RowRole {
  return specOf(contentTypeId).role;
}

export function isXmtpDeletableType(contentTypeId: string | undefined | null): boolean {
  return specOf(contentTypeId).deletable === true;
}

export function entryBuilderOf(typeId: string): { build: EntryBuilder; ignoresContent: boolean } | undefined {
  const spec = specOf(typeId);
  return spec.entry === undefined ? undefined : { build: spec.entry, ignoresContent: spec.entryIgnoresContent === true };
}

function previewOfXmtpContent(decoded: unknown, contentTypeId: string | undefined | null): string {
  const typeId = contentTypeId ? shortTypeId(contentTypeId) : 'unknown';
  if (typeof decoded === 'string') return humanizeMentions(decoded);
  const preview = specOf(typeId).preview;
  return preview ? preview(decoded) : `[${typeId}]`;
}

export function rowPreviewOf(m: { content: unknown; contentTypeId: string | undefined }): string {
  try {
    return previewOfXmtpContent(m.content, m.contentTypeId);
  } catch {
    return `[${m.contentTypeId ?? 'unknown'}]`;
  }
}

export function attachedFilesOf(contentTypeId: string | undefined, content: unknown): AttachedFile[] {
  const record = objectOf(content);
  const files = specOf(contentTypeId).files;
  return record === undefined || files === undefined ? [] : files(record);
}

const ALL_CODECS: readonly { codec: StageCodec; onlyOn?: CodecPlatform }[] = Object.values(CONTENT_TYPES).flatMap((spec) =>
  spec.codec === undefined ? [] : [{ codec: spec.codec, onlyOn: spec.codecOnlyOn }],
);

export function stageCodecsFor(platform: CodecPlatform): StageCodec[] {
  return ALL_CODECS.filter((c) => c.onlyOn === undefined || c.onlyOn === platform).map((c) => c.codec);
}
