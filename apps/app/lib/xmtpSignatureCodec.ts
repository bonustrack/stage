/**
 * @file SignatureRequestCodec and SignatureReferenceCodec, the pure-JS @xmtp/react-native-sdk
 *  content codecs for the custom Metro `metro.box/signatureRequest:1.0` and `signatureReference:1.0`
 *  types (arbitrary-message signing, which has no official XMTP type), each with a plain-text fallback.
 */

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
import {
  signatureRequestSchema, signatureReferenceSchema,
} from '@stage-labs/client/xmtp/sign.schema';

export class SignatureRequestCodec implements JSContentCodec<SignatureRequestContent> {
  contentType: ContentTypeId = SIGNATURE_REQUEST_CONTENT_TYPE;

  /** Encode a signature request as JSON-bytes content with its plain-text fallback. */
  encode(content: SignatureRequestContent): EncodedContent {
    return encodeJsonContent(this.contentType, content, signatureRequestFallbackText(content));
  }

  /** Decode and schema-validate the untrusted signature-request wire body. */
  decode(encoded: EncodedContent): SignatureRequestContent {
    /** SECURITY: validate the untrusted wire body against the strict schema so a malformed / hostile signature request throws here (rendered as an unsupported bubble) and can never reach the signer as a wrong-but-typed object. */
    return decodeJsonContent<SignatureRequestContent>(
      encoded.content, signatureRequestSchema, 'xmtp.signatureRequest',
    );
  }

  /** Plain-text rendering shown by clients missing this codec. */
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

  /** Encode a signature receipt as JSON-bytes content with its plain-text fallback. */
  encode(content: SignatureReferenceContent): EncodedContent {
    return encodeJsonContent(this.contentType, content, signatureReferenceFallbackText(content));
  }

  /** Decode and schema-validate the signature-reference wire body. */
  decode(encoded: EncodedContent): SignatureReferenceContent {
    return decodeJsonContent<SignatureReferenceContent>(
      encoded.content, signatureReferenceSchema, 'xmtp.signatureReference',
    );
  }

  /** Plain-text rendering shown by clients missing this codec. */
  fallback(content: SignatureReferenceContent): string | undefined {
    return signatureReferenceFallbackText(content);
  }

  /** A signature receipt confirming the request was signed — push it. */
  shouldPush(): boolean {
    return true;
  }
}
