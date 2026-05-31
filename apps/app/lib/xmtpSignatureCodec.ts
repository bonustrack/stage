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

import { Buffer } from 'buffer';
import type {
  JSContentCodec, ContentTypeId, EncodedContent,
} from '@xmtp/react-native-sdk';
import {
  type SignatureRequestContent, type SignatureReferenceContent,
  signatureRequestFallbackText, signatureReferenceFallbackText,
} from '@metro-labs/client/xmtp/sign';

export class SignatureRequestCodec implements JSContentCodec<SignatureRequestContent> {
  contentType: ContentTypeId = {
    authorityId: 'metro.box',
    typeId: 'signatureRequest',
    versionMajor: 1,
    versionMinor: 0,
  };

  encode(content: SignatureRequestContent): EncodedContent {
    return {
      type: this.contentType,
      parameters: {},
      fallback: signatureRequestFallbackText(content),
      content: new Uint8Array(Buffer.from(JSON.stringify(content), 'utf8')),
    };
  }

  decode(encoded: EncodedContent): SignatureRequestContent {
    return JSON.parse(Buffer.from(encoded.content).toString('utf8')) as SignatureRequestContent;
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
  contentType: ContentTypeId = {
    authorityId: 'metro.box',
    typeId: 'signatureReference',
    versionMajor: 1,
    versionMinor: 0,
  };

  encode(content: SignatureReferenceContent): EncodedContent {
    return {
      type: this.contentType,
      parameters: {},
      fallback: signatureReferenceFallbackText(content),
      content: new Uint8Array(Buffer.from(JSON.stringify(content), 'utf8')),
    };
  }

  decode(encoded: EncodedContent): SignatureReferenceContent {
    return JSON.parse(Buffer.from(encoded.content).toString('utf8')) as SignatureReferenceContent;
  }

  fallback(content: SignatureReferenceContent): string | undefined {
    return signatureReferenceFallbackText(content);
  }

  /** A signature receipt confirming the request was signed — push it. */
  shouldPush(): boolean {
    return true;
  }
}
