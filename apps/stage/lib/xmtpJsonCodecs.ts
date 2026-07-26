
import type {
  JSContentCodec, ContentTypeId, EncodedContent,
} from '@xmtp/react-native-sdk';
import { type PollContent, pollFallbackText } from '@stage-labs/client/xmtp/poll';
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

type JsonCodec<T> = JSContentCodec<T> & { shouldPush: () => boolean };

type JsonSchema<T> = Parameters<typeof decodeJsonContent<T>>[1];

function jsonCodec<T>(
  contentType: ContentTypeId,
  fallbackText: (content: T) => string,
  schema?: JsonSchema<T>,
  boundary?: string,
): JsonCodec<T> {
  return {
    contentType,
    encode: (content: T): EncodedContent =>
      encodeJsonContent(contentType, content, fallbackText(content)),
    decode: (encoded: EncodedContent): T => (schema
      ? decodeJsonContent<T>(encoded.content, schema, boundary)
      : decodeJsonContent<T>(encoded.content)),
    fallback: (content: T): string | undefined => fallbackText(content),
    shouldPush: (): boolean => true,
  };
}

export const POLL_CODEC = jsonCodec<PollContent>(POLL_CONTENT_TYPE, pollFallbackText);

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
