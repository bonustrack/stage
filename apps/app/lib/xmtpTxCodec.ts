/** WalletSendCallsCodec + TransactionReferenceCodec — the RN
 *  @xmtp/react-native-sdk JS content codecs for the official XMTP transaction
 *  content types `xmtp.org/walletSendCalls:1.0` and
 *  `xmtp.org/transactionReference:1.0`.
 *
 *  Pure JS (no native module): both bodies are just `JSON.stringify(content)`
 *  encoded as UTF-8 bytes inside an `EncodedContent`, so registering them in
 *  `XMTP_CODECS` needs NO dev-client rebuild. We can't reuse the npm
 *  `@xmtp/content-type-wallet-send-calls` / `-transaction-reference` packages:
 *  they target the Node SDK's `ContentCodec`/`EncodedContent` shape, which is
 *  incompatible with the RN SDK's `JSContentCodec` interface (mirrors why
 *  PollCodec is hand-rolled). `fallback` carries the plain-text rendering so
 *  vanilla XMTP clients (and any client missing this codec) show a readable
 *  string instead of a blank/error bubble. */

import type {
  JSContentCodec, ContentTypeId, EncodedContent,
} from '@xmtp/react-native-sdk';
import {
  type WalletSendCallsContent, type TransactionReferenceContent,
  walletSendCallsFallbackText, transactionReferenceFallbackText,
} from '@stage-labs/client/xmtp/tx';
import {
  WALLET_SEND_CALLS_CONTENT_TYPE, TRANSACTION_REFERENCE_CONTENT_TYPE,
  encodeJsonContent, decodeJsonContent,
} from '@stage-labs/client/xmtp/codecs';
import {
  walletSendCallsSchema, transactionReferenceSchema,
} from '@stage-labs/client/xmtp/tx.schema';

export class WalletSendCallsCodec implements JSContentCodec<WalletSendCallsContent> {
  contentType: ContentTypeId = WALLET_SEND_CALLS_CONTENT_TYPE;

  /** Encode a payment request as JSON-bytes content with its plain-text fallback. */
  encode(content: WalletSendCallsContent): EncodedContent {
    return encodeJsonContent(this.contentType, content, walletSendCallsFallbackText(content));
  }

  /** Decode and schema-validate the untrusted payment-request wire body. */
  decode(encoded: EncodedContent): WalletSendCallsContent {
    /** SECURITY: validate the untrusted wire body so a malformed / hostile
     *  payment request throws here (rendered unsupported) instead of reaching the
     *  pay path as a wrong-but-typed object. */
    return decodeJsonContent<WalletSendCallsContent>(
      encoded.content, walletSendCallsSchema, 'xmtp.walletSendCalls',
    );
  }

  /** Plain-text rendering shown by clients missing this codec. */
  fallback(content: WalletSendCallsContent): string | undefined {
    return walletSendCallsFallbackText(content);
  }

  /** A payment request is worth a push. */
  shouldPush(): boolean {
    return true;
  }
}

export class TransactionReferenceCodec implements JSContentCodec<TransactionReferenceContent> {
  contentType: ContentTypeId = TRANSACTION_REFERENCE_CONTENT_TYPE;

  /** Encode a transaction receipt as JSON-bytes content with its plain-text fallback. */
  encode(content: TransactionReferenceContent): EncodedContent {
    return encodeJsonContent(this.contentType, content, transactionReferenceFallbackText(content));
  }

  /** Decode and schema-validate the transaction-reference wire body. */
  decode(encoded: EncodedContent): TransactionReferenceContent {
    return decodeJsonContent<TransactionReferenceContent>(
      encoded.content, transactionReferenceSchema, 'xmtp.transactionReference',
    );
  }

  /** Plain-text rendering shown by clients missing this codec. */
  fallback(content: TransactionReferenceContent): string | undefined {
    return transactionReferenceFallbackText(content);
  }

  /** A receipt confirming a payment landed — push it. */
  shouldPush(): boolean {
    return true;
  }
}
