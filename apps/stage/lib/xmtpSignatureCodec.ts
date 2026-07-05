
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

  encode(content: SignatureRequestContent): EncodedContent {
    return encodeJsonContent(this.contentType, content, signatureRequestFallbackText(content));
  }

  decode(encoded: EncodedContent): SignatureRequestContent {
    return decodeJsonContent<SignatureRequestContent>(
      encoded.content, signatureRequestSchema, 'xmtp.signatureRequest',
    );
  }

  fallback(content: SignatureRequestContent): string | undefined {
    return signatureRequestFallbackText(content);
  }

  shouldPush(): boolean {
    return true;
  }
}

export class SignatureReferenceCodec implements JSContentCodec<SignatureReferenceContent> {
  contentType: ContentTypeId = SIGNATURE_REFERENCE_CONTENT_TYPE;

  encode(content: SignatureReferenceContent): EncodedContent {
    return encodeJsonContent(this.contentType, content, signatureReferenceFallbackText(content));
  }

  decode(encoded: EncodedContent): SignatureReferenceContent {
    return decodeJsonContent<SignatureReferenceContent>(
      encoded.content, signatureReferenceSchema, 'xmtp.signatureReference',
    );
  }

  fallback(content: SignatureReferenceContent): string | undefined {
    return signatureReferenceFallbackText(content);
  }

  shouldPush(): boolean {
    return true;
  }
}
