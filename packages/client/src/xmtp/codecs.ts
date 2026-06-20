/** @file Framework-agnostic XMTP content-type descriptors and JSON wire codec body helpers for the Metro custom content types, living here once so app/daemon/web share the JSON.stringify round-trip without native @xmtp/react-native/expo imports. */

import type { ZodType } from 'zod';
import { parseOrThrow, type BoundaryName } from '../validate';

/** A content-type descriptor — structurally the RN SDK's `ContentTypeId`, but declared here so the package never imports the native type. The app's codec classes assign one of these to their `contentType` field. */
export interface XmtpContentTypeId {
  authorityId: string;
  typeId: string;
  versionMajor: number;
  versionMinor: number;
}

/** Metro poll — `metro.box/poll:1.0`. */
export const POLL_CONTENT_TYPE: XmtpContentTypeId = {
  authorityId: 'metro.box', typeId: 'poll', versionMajor: 1, versionMinor: 0,
};
/** Metro signature REQUEST — `metro.box/signatureRequest:1.0`. */
export const SIGNATURE_REQUEST_CONTENT_TYPE: XmtpContentTypeId = {
  authorityId: 'metro.box', typeId: 'signatureRequest', versionMajor: 1, versionMinor: 0,
};
/** Metro signature RECEIPT — `metro.box/signatureReference:1.0`. */
export const SIGNATURE_REFERENCE_CONTENT_TYPE: XmtpContentTypeId = {
  authorityId: 'metro.box', typeId: 'signatureReference', versionMajor: 1, versionMinor: 0,
};
/** Official XMTP payment REQUEST — `xmtp.org/walletSendCalls:1.0`. */
export const WALLET_SEND_CALLS_CONTENT_TYPE: XmtpContentTypeId = {
  authorityId: 'xmtp.org', typeId: 'walletSendCalls', versionMajor: 1, versionMinor: 0,
};
/** Official XMTP payment RECEIPT — `xmtp.org/transactionReference:1.0`. */
export const TRANSACTION_REFERENCE_CONTENT_TYPE: XmtpContentTypeId = {
  authorityId: 'xmtp.org', typeId: 'transactionReference', versionMajor: 1, versionMinor: 0,
};

/** The platform-neutral subset of the RN SDK's `EncodedContent` that every Metro JSON codec produces. The app casts this to the native EncodedContent (structurally identical) inside its codec classes. */
export interface EncodedJsonContent {
  type: XmtpContentTypeId;
  parameters: Record<string, string>;
  fallback?: string;
  content: Uint8Array;
}

/** Encodes any JSON-serializable Metro content into an EncodedContent body (JSON.stringify -> UTF-8 bytes); `fallback` carries plain text so clients missing the codec show a readable string. */
export function encodeJsonContent(
  type: XmtpContentTypeId,
  content: unknown,
  fallback?: string,
): EncodedJsonContent {
  return {
    type,
    parameters: {},
    fallback,
    content: new TextEncoder().encode(JSON.stringify(content)),
  };
}

/** Decodes a JSON-bodied EncodedContent back into its content shape; when a `schema` is supplied a malformed wire body throws loudly at this boundary, otherwise it keeps the legacy `as`-cast behaviour. */
export function decodeJsonContent<T>(
  bytes: Uint8Array,
  schema?: ZodType<T>,
  where: BoundaryName = 'xmtp.codec',
): T {
  const data: unknown = JSON.parse(new TextDecoder().decode(bytes));
  return schema ? parseOrThrow(where, schema, data) : (data as T);
}
