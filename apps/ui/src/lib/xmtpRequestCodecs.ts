
import {
  type WalletSendCallsContent, walletSendCallsFallbackText,
} from '@stage-labs/client/xmtp/tx';
import {
  type SignatureRequestContent, signatureRequestFallbackText,
} from '@stage-labs/client/xmtp/sign';
import {
  WALLET_SEND_CALLS_CONTENT_TYPE, SIGNATURE_REQUEST_CONTENT_TYPE,
  encodeJsonContent, decodeJsonContent,
  type XmtpContentTypeId, type EncodedJsonContent,
} from '@stage-labs/client/xmtp/codecs';

export class WalletSendCallsCodec {
  contentType: XmtpContentTypeId = WALLET_SEND_CALLS_CONTENT_TYPE;

  encode(content: WalletSendCallsContent): EncodedJsonContent {
    return encodeJsonContent(this.contentType, content, walletSendCallsFallbackText(content));
  }

  decode(encoded: { content: Uint8Array }): WalletSendCallsContent {
    return decodeJsonContent<WalletSendCallsContent>(encoded.content);
  }

  fallback(content: WalletSendCallsContent): string | undefined {
    return walletSendCallsFallbackText(content);
  }

  shouldPush(): boolean {
    return true;
  }
}

export class SignatureRequestCodec {
  contentType: XmtpContentTypeId = SIGNATURE_REQUEST_CONTENT_TYPE;

  encode(content: SignatureRequestContent): EncodedJsonContent {
    return encodeJsonContent(this.contentType, content, signatureRequestFallbackText(content));
  }

  decode(encoded: { content: Uint8Array }): SignatureRequestContent {
    return decodeJsonContent<SignatureRequestContent>(encoded.content);
  }

  fallback(content: SignatureRequestContent): string | undefined {
    return signatureRequestFallbackText(content);
  }

  shouldPush(): boolean {
    return true;
  }
}

export const WALLET_SEND_CALLS_CODEC = new WalletSendCallsCodec();
export const SIGNATURE_REQUEST_CODEC = new SignatureRequestCodec();
