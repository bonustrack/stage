/** Framework-agnostic XMTP content-type DESCRIPTORS + JSON wire codec body
 *  helpers for the Metro custom content types.
 *
 *  The RN app registers JSContentCodecs (which `implements` the
 *  @xmtp/react-native-sdk JSContentCodec interface — that native interface keeps
 *  the codec CLASSES in apps/app). But every Metro codec's wire body is the same
 *  pure pattern: `JSON.stringify(content)` -> UTF-8 bytes inside an
 *  EncodedContent, and the reverse on decode. That logic plus the content-type
 *  descriptors live here ONCE so the app (and the daemon / web) don't duplicate
 *  the serialization.
 *
 *  ZERO @xmtp / react-native / expo imports. Uses only standard globals
 *  (TextEncoder / TextDecoder) so the byte round-trip is platform-neutral; the
 *  RN app's Buffer polyfill is no longer needed for these bodies. */

/** A content-type descriptor — structurally the RN SDK's `ContentTypeId`, but
 *  declared here so the package never imports the native type. The app's codec
 *  classes assign one of these to their `contentType` field. */
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

/** The platform-neutral subset of the RN SDK's `EncodedContent` that every
 *  Metro JSON codec produces. The app casts this to the native EncodedContent
 *  (structurally identical) inside its codec classes. */
export interface EncodedJsonContent {
  type: XmtpContentTypeId;
  parameters: Record<string, string>;
  fallback?: string;
  content: Uint8Array;
}

/** Encode any JSON-serializable Metro content into an EncodedContent body:
 *  `JSON.stringify` -> UTF-8 bytes. `fallback` carries the plain-text rendering
 *  so vanilla XMTP clients (and any client missing the codec) show a readable
 *  string instead of a blank/error bubble. */
export function encodeJsonContent<T>(
  type: XmtpContentTypeId,
  content: T,
  fallback?: string,
): EncodedJsonContent {
  return {
    type,
    parameters: {},
    fallback,
    content: new TextEncoder().encode(JSON.stringify(content)),
  };
}

/** Decode a JSON-bodied EncodedContent back into its content shape. Accepts the
 *  bytes off the EncodedContent (`encoded.content`). */
export function decodeJsonContent<T>(bytes: Uint8Array): T {
  return JSON.parse(new TextDecoder().decode(bytes)) as T;
}
