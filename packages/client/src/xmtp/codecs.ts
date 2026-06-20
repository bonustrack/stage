
import type { ZodType } from 'zod';
import { parseOrThrow, type BoundaryName } from '../validate';

export interface XmtpContentTypeId {
  authorityId: string;
  typeId: string;
  versionMajor: number;
  versionMinor: number;
}

export const POLL_CONTENT_TYPE: XmtpContentTypeId = {
  authorityId: 'metro.box', typeId: 'poll', versionMajor: 1, versionMinor: 0,
};
export const SIGNATURE_REQUEST_CONTENT_TYPE: XmtpContentTypeId = {
  authorityId: 'metro.box', typeId: 'signatureRequest', versionMajor: 1, versionMinor: 0,
};
export const SIGNATURE_REFERENCE_CONTENT_TYPE: XmtpContentTypeId = {
  authorityId: 'metro.box', typeId: 'signatureReference', versionMajor: 1, versionMinor: 0,
};
export const WALLET_SEND_CALLS_CONTENT_TYPE: XmtpContentTypeId = {
  authorityId: 'xmtp.org', typeId: 'walletSendCalls', versionMajor: 1, versionMinor: 0,
};
export const TRANSACTION_REFERENCE_CONTENT_TYPE: XmtpContentTypeId = {
  authorityId: 'xmtp.org', typeId: 'transactionReference', versionMajor: 1, versionMinor: 0,
};

export interface EncodedJsonContent {
  type: XmtpContentTypeId;
  parameters: Record<string, string>;
  fallback?: string;
  content: Uint8Array;
}

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

export function decodeJsonContent<T>(
  bytes: Uint8Array,
  schema?: ZodType<T>,
  where: BoundaryName = 'xmtp.codec',
): T {
  const data: unknown = JSON.parse(new TextDecoder().decode(bytes));
  return schema ? parseOrThrow(where, schema, data) : (data as T);
}
