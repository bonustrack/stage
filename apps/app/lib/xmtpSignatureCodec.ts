/** SignatureRequestCodec + SignatureReferenceCodec — the RN
 *  @xmtp/react-native-sdk JS content codecs for the Metro signature content
 *  types `metro.box/signatureRequest:1.0` and `metro.box/signatureReference:1.0`.
 *
 *  There is no official XMTP signature-request content type (walletSendCalls /
 *  transactionReference are for broadcasting txs, not signing an arbitrary
 *  message), so this is a CUSTOM Metro content type under our own authority,
 *  mirroring PollCodec / the tx codecs.
 *
 *  Pure JS (no native module): both bodies are just `JSON.stringify(content)`
 *  encoded as UTF-8 bytes inside an `EncodedContent`, so registering them in
 *  `XMTP_CODECS` needs NO dev-client rebuild. `fallback` carries the plain-text
 *  rendering so vanilla XMTP clients (and any client missing this codec) show a
 *  readable string instead of a blank/error bubble. */

import type {
  JSContentCodec, ContentTypeId, EncodedContent,
} from '@xmtp/react-native-sdk';
import {
  type SignatureRequestContent, type SignatureReferenceContent,
  signatureRequestFallbackText, signatureReferenceFallbackText,
} from '@stage-labs/client/xmtp/sign';
import {
  SIGNATURE_REQUEST_CONTENT_TYPE, SIGNATURE_REFERENCE_CONTENT_TYPE,
  encodeJsonContent, decodeJsonContent,
} from '@stage-labs/client/xmtp/codecs';

export class SignatureRequestCodec implements JSContentCodec<SignatureRequestContent> {
  contentType: ContentTypeId = SIGNATURE_REQUEST_CONTENT_TYPE;

  encode(content: SignatureRequestContent): EncodedContent {
    return encodeJsonContent(this.contentType, content, signatureRequestFallbackText(content)) as EncodedContent;
  }

  decode(encoded: EncodedContent): SignatureRequestContent {
    return decodeJsonContent<SignatureRequestContent>(encoded.content);
  }

  fallback(content: SignatureRequestContent): string | undefined {
    return signatureRequestFallbackText(content);
  }

  /** A signature request is worth a push. */
  shouldPush(): boolean {
    return true;
  }
}

export class SignatureReferenceCodec implements JSContentCodec<SignatureReferenceContent> {
  contentType: ContentTypeId = SIGNATURE_REFERENCE_CONTENT_TYPE;

  encode(content: SignatureReferenceContent): EncodedContent {
    return encodeJsonContent(this.contentType, content, signatureReferenceFallbackText(content)) as EncodedContent;
  }

  decode(encoded: EncodedContent): SignatureReferenceContent {
    return decodeJsonContent<SignatureReferenceContent>(encoded.content);
  }

  fallback(content: SignatureReferenceContent): string | undefined {
    return signatureReferenceFallbackText(content);
  }

  /** A signature receipt confirming the request was signed — push it. */
  shouldPush(): boolean {
    return true;
  }
}
