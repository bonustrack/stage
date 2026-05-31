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

import { Buffer } from 'buffer';
import type {
  JSContentCodec, ContentTypeId, EncodedContent,
} from '@xmtp/react-native-sdk';
import {
  type WalletSendCallsContent, type TransactionReferenceContent,
  walletSendCallsFallbackText, transactionReferenceFallbackText,
} from '@metro-labs/client/xmtp/tx';

export class WalletSendCallsCodec implements JSContentCodec<WalletSendCallsContent> {
  contentType: ContentTypeId = {
    authorityId: 'xmtp.org',
    typeId: 'walletSendCalls',
    versionMajor: 1,
    versionMinor: 0,
  };

  encode(content: WalletSendCallsContent): EncodedContent {
    return {
      type: this.contentType,
      parameters: {},
      fallback: walletSendCallsFallbackText(content),
      content: new Uint8Array(Buffer.from(JSON.stringify(content), 'utf8')),
    };
  }

  decode(encoded: EncodedContent): WalletSendCallsContent {
    return JSON.parse(Buffer.from(encoded.content).toString('utf8')) as WalletSendCallsContent;
  }

  fallback(content: WalletSendCallsContent): string | undefined {
    return walletSendCallsFallbackText(content);
  }

  /** A payment request is worth a push. */
  shouldPush(): boolean {
    return true;
  }
}

export class TransactionReferenceCodec implements JSContentCodec<TransactionReferenceContent> {
  contentType: ContentTypeId = {
    authorityId: 'xmtp.org',
    typeId: 'transactionReference',
    versionMajor: 1,
    versionMinor: 0,
  };

  encode(content: TransactionReferenceContent): EncodedContent {
    return {
      type: this.contentType,
      parameters: {},
      fallback: transactionReferenceFallbackText(content),
      content: new Uint8Array(Buffer.from(JSON.stringify(content), 'utf8')),
    };
  }

  decode(encoded: EncodedContent): TransactionReferenceContent {
    return JSON.parse(Buffer.from(encoded.content).toString('utf8')) as TransactionReferenceContent;
  }

  fallback(content: TransactionReferenceContent): string | undefined {
    return transactionReferenceFallbackText(content);
  }

  /** A receipt confirming a payment landed — push it. */
  shouldPush(): boolean {
    return true;
  }
}
