import { pollFallbackText } from './poll';
import { pollContentSchema } from './poll.schema';
import { signatureRequestFallbackText, signatureReferenceFallbackText } from './sign';
import { walletSendCallsFallbackText, transactionReferenceFallbackText } from './tx';
import {
  POLL_CONTENT_TYPE,
  SIGNATURE_REQUEST_CONTENT_TYPE,
  SIGNATURE_REFERENCE_CONTENT_TYPE,
  WALLET_SEND_CALLS_CONTENT_TYPE,
  TRANSACTION_REFERENCE_CONTENT_TYPE,
  encodeJsonContent,
  decodeJsonContent,
  type EncodedJsonContent,
  type XmtpContentTypeId,
} from './codecs';
import { signatureRequestSchema, signatureReferenceSchema } from './sign.schema';
import { walletSendCallsSchema, transactionReferenceSchema } from './tx.schema';
import { SYNC_TYPES, type SyncContents, type SyncKind } from './readState';
import type { OutputSchema } from '../validate';
import { FRAME_CONTENT_TYPE, FRAME_ACTION_CONTENT_TYPE, frameFallbackText, frameActionFallbackText } from './frame';
import { frameContentSchema, frameActionSchema } from './frame.schema';
import { STAGE_DELETE_CONTENT_TYPE, deleteMessageSchema } from './deleteMessage';
import { CALL_INVITE_CONTENT_TYPE, CALL_SIGNAL_CONTENT_TYPE, callInviteSchema, callInviteText, callSignalSchema } from './call';

export interface JsonCodec<T> {
  contentType: XmtpContentTypeId;
  encode: (content: T) => EncodedJsonContent;
  decode: (encoded: { content: Uint8Array }) => T;
  fallback: (content: T) => string | undefined;
  shouldPush: () => boolean;
}

function jsonCodec<T>(
  contentType: XmtpContentTypeId,
  fallbackText: (content: T) => string | undefined,
  schema: OutputSchema<T>,
  boundary?: string,
  push = true,
): JsonCodec<T> {
  return {
    contentType,
    encode: (content: T): EncodedJsonContent => encodeJsonContent(contentType, content, fallbackText(content)),
    decode: (encoded: { content: Uint8Array }): T => decodeJsonContent<T>(encoded.content, schema, boundary),
    fallback: (content: T): string | undefined => fallbackText(content),
    shouldPush: (): boolean => push,
  };
}

export const POLL_CODEC = jsonCodec(POLL_CONTENT_TYPE, pollFallbackText, pollContentSchema, 'xmtp.poll');

export const SIGNATURE_REQUEST_CODEC = jsonCodec(
  SIGNATURE_REQUEST_CONTENT_TYPE,
  signatureRequestFallbackText,
  signatureRequestSchema,
  'xmtp.signatureRequest',
);

export const SIGNATURE_REFERENCE_CODEC = jsonCodec(
  SIGNATURE_REFERENCE_CONTENT_TYPE,
  signatureReferenceFallbackText,
  signatureReferenceSchema,
  'xmtp.signatureReference',
);

export const WALLET_SEND_CALLS_CODEC = jsonCodec(
  WALLET_SEND_CALLS_CONTENT_TYPE,
  walletSendCallsFallbackText,
  walletSendCallsSchema,
  'xmtp.walletSendCalls',
);

export const TRANSACTION_REFERENCE_CODEC = jsonCodec(
  TRANSACTION_REFERENCE_CONTENT_TYPE,
  transactionReferenceFallbackText,
  transactionReferenceSchema,
  'xmtp.transactionReference',
);

function syncCodec<K extends SyncKind>(kind: K): JsonCodec<SyncContents[K]> {
  const { contentType, schema, fallback } = SYNC_TYPES[kind];
  return jsonCodec(contentType, () => fallback, schema, undefined, false);
}

export const SYNC_CODECS: { [K in SyncKind]: JsonCodec<SyncContents[K]> } = {
  read: syncCodec('read'),
  pin: syncCodec('pin'),
  clear: syncCodec('clear'),
  board: syncCodec('board'),
  categoryOrder: syncCodec('categoryOrder'),
  search: syncCodec('search'),
  homeView: syncCodec('homeView'),
  dashboard: syncCodec('dashboard'),
  developerMode: syncCodec('developerMode'),
};

export const CALL_INVITE_CODEC = jsonCodec(CALL_INVITE_CONTENT_TYPE, callInviteText, callInviteSchema, 'xmtp.callInvite');

export const CALL_SIGNAL_CODEC = jsonCodec(CALL_SIGNAL_CONTENT_TYPE, () => undefined, callSignalSchema, 'xmtp.callSignal', false);

const FRAME_CODEC = jsonCodec(FRAME_CONTENT_TYPE, frameFallbackText, frameContentSchema, 'xmtp.frame');

export const FRAME_ACTION_CODEC = jsonCodec(FRAME_ACTION_CONTENT_TYPE, frameActionFallbackText, frameActionSchema, 'xmtp.frameAction');

export const DELETE_REQUEST_CODEC = jsonCodec(STAGE_DELETE_CONTENT_TYPE, () => undefined, deleteMessageSchema, 'xmtp.deleteRequest', false);

export const STAGE_JSON_CODECS = [
  POLL_CODEC,
  SIGNATURE_REQUEST_CODEC,
  SIGNATURE_REFERENCE_CODEC,
  WALLET_SEND_CALLS_CODEC,
  ...Object.values(SYNC_CODECS),
  CALL_INVITE_CODEC,
  CALL_SIGNAL_CODEC,
  FRAME_CODEC,
  FRAME_ACTION_CODEC,
  DELETE_REQUEST_CODEC,
];
