
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

  encode(content: WalletSendCallsContent): EncodedContent {
    return encodeJsonContent(this.contentType, content, walletSendCallsFallbackText(content));
  }

  decode(encoded: EncodedContent): WalletSendCallsContent {
    return decodeJsonContent<WalletSendCallsContent>(
      encoded.content, walletSendCallsSchema, 'xmtp.walletSendCalls',
    );
  }

  fallback(content: WalletSendCallsContent): string | undefined {
    return walletSendCallsFallbackText(content);
  }

  shouldPush(): boolean {
    return true;
  }
}

export class TransactionReferenceCodec implements JSContentCodec<TransactionReferenceContent> {
  contentType: ContentTypeId = TRANSACTION_REFERENCE_CONTENT_TYPE;

  encode(content: TransactionReferenceContent): EncodedContent {
    return encodeJsonContent(this.contentType, content, transactionReferenceFallbackText(content));
  }

  decode(encoded: EncodedContent): TransactionReferenceContent {
    return decodeJsonContent<TransactionReferenceContent>(
      encoded.content, transactionReferenceSchema, 'xmtp.transactionReference',
    );
  }

  fallback(content: TransactionReferenceContent): string | undefined {
    return transactionReferenceFallbackText(content);
  }

  shouldPush(): boolean {
    return true;
  }
}
