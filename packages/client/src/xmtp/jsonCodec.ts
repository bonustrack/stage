import { encodeJsonContent, decodeJsonContent, type EncodedJsonContent, type XmtpContentTypeId } from './codecs';
import type { OutputSchema } from '../validate';

export interface JsonCodec<T> {
  contentType: XmtpContentTypeId;
  encode: (content: T) => EncodedJsonContent;
  decode: (encoded: { content: Uint8Array }) => T;
  fallback: (content: T) => string | undefined;
  shouldPush: () => boolean;
}

export function jsonCodec<T>(
  contentType: XmtpContentTypeId,
  fallbackText: (content: T) => string | undefined,
  schema: OutputSchema<T>,
  boundary?: string,
  push = true,
): JsonCodec<T> {
  return {
    contentType,
    encode: (content: T): EncodedJsonContent => encodeJsonContent(contentType, content, fallbackText(content)),
    decode: (encoded: { content: Uint8Array }): T => decodeJsonContent<T>(encoded.content, schema, boundary),
    fallback: (content: T): string | undefined => fallbackText(content),
    shouldPush: (): boolean => push,
  };
}
