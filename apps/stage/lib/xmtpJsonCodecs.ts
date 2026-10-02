import type {
  JSContentCodec, ContentTypeId, EncodedContent,
} from '@xmtp/react-native-sdk';
import { type PollContent, pollFallbackText } from '@stage-labs/client/xmtp/poll';
import { pollContentSchema } from '@stage-labs/client/xmtp/poll.schema';
import {
  type SignatureRequestContent, type SignatureReferenceContent,
  signatureRequestFallbackText, signatureReferenceFallbackText,
} from '@stage-labs/client/xmtp/sign';
import {
  type WalletSendCallsContent, type TransactionReferenceContent,
  walletSendCallsFallbackText, transactionReferenceFallbackText,
} from '@stage-labs/client/xmtp/tx';
import {
  POLL_CONTENT_TYPE, SIGNATURE_REQUEST_CONTENT_TYPE, SIGNATURE_REFERENCE_CONTENT_TYPE,
  WALLET_SEND_CALLS_CONTENT_TYPE, TRANSACTION_REFERENCE_CONTENT_TYPE,
  encodeJsonContent, decodeJsonContent,
} from '@stage-labs/client/xmtp/codecs';
import {
  signatureRequestSchema, signatureReferenceSchema,
} from '@stage-labs/client/xmtp/sign.schema';
import {
  walletSendCallsSchema, transactionReferenceSchema,
} from '@stage-labs/client/xmtp/tx.schema';
import {
  READ_STATE_CONTENT_TYPE, readStateFallbackText, readStateSchema, type ReadStateContent,
  PIN_STATE_CONTENT_TYPE, pinStateFallbackText, pinStateSchema, type PinStateContent,
  CLEAR_STATE_CONTENT_TYPE, clearStateFallbackText, clearStateSchema, type ClearStateContent,
  BOARD_STATE_CONTENT_TYPE, boardStateFallbackText, boardStateSchema, type BoardStateContent,
  SEARCH_STATE_CONTENT_TYPE, searchStateFallbackText, searchStateSchema, type SearchStateContent,
} from '@stage-labs/client/xmtp/readState';
import {
  FRAME_CONTENT_TYPE, FRAME_ACTION_CONTENT_TYPE, frameFallbackText, frameActionFallbackText,
  type FrameContent, type FrameActionContent,
} from '@stage-labs/client/xmtp/frame';
import { frameContentSchema, frameActionSchema } from '@stage-labs/client/xmtp/frame.schema';
import {
  STAGE_DELETE_CONTENT_TYPE, deleteMessageSchema, type DeleteMessageContent,
} from '@stage-labs/client/xmtp/deleteMessage';
import {
  CALL_INVITE_CONTENT_TYPE, CALL_SIGNAL_CONTENT_TYPE, callInviteSchema, callInviteText, callSignalSchema,
  type CallInvite, type CallSignal,
} from '@stage-labs/client/xmtp/call';

export type JsonCodec<T> = JSContentCodec<T> & { shouldPush: () => boolean };

type JsonSchema<T> = Parameters<typeof decodeJsonContent<T>>[1];

function jsonCodec<T>(
  contentType: ContentTypeId,
  fallbackText: (content: T) => string | undefined,
  schema: JsonSchema<T>,
  boundary?: string,
  push = true,
): JsonCodec<T> {
  return {
    contentType,
    encode: (content: T): EncodedContent =>
      encodeJsonContent(contentType, content, fallbackText(content)),
    decode: (encoded: EncodedContent): T => decodeJsonContent<T>(encoded.content, schema, boundary),
    fallback: (content: T): string | undefined => fallbackText(content),
    shouldPush: (): boolean => push,
  };
}

export const POLL_CODEC = jsonCodec<PollContent>(POLL_CONTENT_TYPE, pollFallbackText, pollContentSchema, 'xmtp.poll');

export const SIGNATURE_REQUEST_CODEC = jsonCodec<SignatureRequestContent>(
  SIGNATURE_REQUEST_CONTENT_TYPE, signatureRequestFallbackText,
  signatureRequestSchema, 'xmtp.signatureRequest',
);

export const SIGNATURE_REFERENCE_CODEC = jsonCodec<SignatureReferenceContent>(
  SIGNATURE_REFERENCE_CONTENT_TYPE, signatureReferenceFallbackText,
  signatureReferenceSchema, 'xmtp.signatureReference',
);

export const WALLET_SEND_CALLS_CODEC = jsonCodec<WalletSendCallsContent>(
  WALLET_SEND_CALLS_CONTENT_TYPE, walletSendCallsFallbackText,
  walletSendCallsSchema, 'xmtp.walletSendCalls',
);

export const TRANSACTION_REFERENCE_CODEC = jsonCodec<TransactionReferenceContent>(
  TRANSACTION_REFERENCE_CONTENT_TYPE, transactionReferenceFallbackText,
  transactionReferenceSchema, 'xmtp.transactionReference',
);

export const READ_STATE_CODEC = jsonCodec<ReadStateContent>(
  READ_STATE_CONTENT_TYPE, readStateFallbackText, readStateSchema, undefined, false,
);

export const PIN_STATE_CODEC = jsonCodec<PinStateContent>(PIN_STATE_CONTENT_TYPE, pinStateFallbackText, pinStateSchema, undefined, false);

export const CLEAR_STATE_CODEC = jsonCodec<ClearStateContent>(
  CLEAR_STATE_CONTENT_TYPE, clearStateFallbackText, clearStateSchema, undefined, false,
);

export const BOARD_STATE_CODEC = jsonCodec<BoardStateContent>(
  BOARD_STATE_CONTENT_TYPE, boardStateFallbackText, boardStateSchema, undefined, false,
);

export const SEARCH_STATE_CODEC = jsonCodec<SearchStateContent>(
  SEARCH_STATE_CONTENT_TYPE, searchStateFallbackText, searchStateSchema, undefined, false,
);

export const CALL_INVITE_CODEC = jsonCodec<CallInvite>(CALL_INVITE_CONTENT_TYPE, callInviteText, callInviteSchema, 'xmtp.callInvite');

export const CALL_SIGNAL_CODEC = jsonCodec<CallSignal>(
  CALL_SIGNAL_CONTENT_TYPE, () => undefined, callSignalSchema, 'xmtp.callSignal', false,
);

const FRAME_CODEC = jsonCodec<FrameContent>(FRAME_CONTENT_TYPE, frameFallbackText, frameContentSchema, 'xmtp.frame');

export const FRAME_ACTION_CODEC = jsonCodec<FrameActionContent>(
  FRAME_ACTION_CONTENT_TYPE, frameActionFallbackText, frameActionSchema, 'xmtp.frameAction',
);

export const DELETE_REQUEST_CODEC = jsonCodec<DeleteMessageContent>(
  STAGE_DELETE_CONTENT_TYPE, () => undefined, deleteMessageSchema, 'xmtp.deleteRequest', false,
);

export const STAGE_JSON_CODECS = [
  POLL_CODEC,
  SIGNATURE_REQUEST_CODEC,
  SIGNATURE_REFERENCE_CODEC,
  WALLET_SEND_CALLS_CODEC,
  READ_STATE_CODEC,
  PIN_STATE_CODEC,
  CLEAR_STATE_CODEC,
  BOARD_STATE_CODEC,
  SEARCH_STATE_CODEC,
  CALL_INVITE_CODEC,
  CALL_SIGNAL_CODEC,
  FRAME_CODEC,
  FRAME_ACTION_CODEC,
  DELETE_REQUEST_CODEC,
];
