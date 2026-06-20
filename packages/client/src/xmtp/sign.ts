/** @file Metro CUSTOM in-chat signature-request/reference content types (no official XMTP equivalent) under our `metro.box` authority — pure TS wire shapes, ids, and plain-text fallbacks for a two-message SignatureRequest -> SignatureReference handshake shared by the RN app, web client, and daemon. */

/** SignatureRequest — `metro.box/signatureRequest:1.0`. */

/** A standard EIP-712 typed-data payload — exactly the `eth_signTypedData_v4` argument shape (domain / types / primaryType / message). Kept loose (record types) so any valid typed-data structure round-trips through JSON unchanged. */
export interface Eip712TypedData {
  domain: Record<string, unknown>;
  types: Record<string, { name: string; type: string }[]>;
  primaryType: string;
  message: Record<string, unknown>;
}

export interface SignatureRequestContent {
  /** Stable id minted at creation; the SignatureReference points back at it so the request and its signature thread together across edits/resends. */
  id: string;
  /** `eip712` => sign typed data; `personal` => personal_sign a UTF-8 string. */
  kind: 'eip712' | 'personal';
  /** Present when `kind === 'eip712'`. Standard eth_signTypedData_v4 shape. */
  eip712?: Eip712TypedData;
  /** Present when `kind === 'personal'`. The plain string to personal_sign. */
  message?: string;
  /** Optional human label shown on the request card + push/preview. */
  description?: string;
}

export const SIGNATURE_REQUEST_TYPE_ID = 'metro.box/signatureRequest:1.0';
export const SIGNATURE_REQUEST_TYPE_SHORT = 'signatureRequest';

/** SignatureReference — `metro.box/signatureReference:1.0`. */

export interface SignatureReferenceContent {
  /** The `id` of the SignatureRequest this answers. */
  requestId: string;
  /** The produced signature, 0x-hex. */
  signature: string;
  /** The signer's address, 0x-hex. */
  signer: string;
}

export const SIGNATURE_REFERENCE_TYPE_ID = 'metro.box/signatureReference:1.0';
export const SIGNATURE_REFERENCE_TYPE_SHORT = 'signatureReference';

/** Fallbacks + helpers (pure, shared by RN + daemon codecs and previews). */

/** Mint a stable signature-request id. Mirrors mintPollId in poll.ts. */
export function mintSignatureRequestId(): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  return `sig_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Plain-text fallback for a SignatureRequest (vanilla XMTP clients show this instead of a blank bubble). */
export function signatureRequestFallbackText(c: SignatureRequestContent): string {
  const desc = c?.description?.trim();
  return desc ? `[Signature request] ${desc}` : '[Signature request]';
}

/** Plain-text fallback for a SignatureReference. */
export function signatureReferenceFallbackText(c: SignatureReferenceContent): string {
  return c?.signature ? `[Signature] ${c.signature}` : '[Signature]';
}

/** One-line preview for the channels list / daemon preview. */
export function signatureRequestPreviewText(c: SignatureRequestContent): string {
  const desc = c?.description?.trim();
  return desc ? `Signature request: ${desc}` : 'Signature request';
}
/** One-line channels-list preview for a SignatureReference receipt. */
export function signatureReferencePreviewText(): string {
  return 'Signature';
}
