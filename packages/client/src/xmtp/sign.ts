

export interface Eip712TypedData {
  domain: Record<string, unknown>;
  types: Record<string, { name: string; type: string }[]>;
  primaryType: string;
  message: Record<string, unknown>;
}

export interface SignatureRequestContent {
  id: string;
  kind: 'eip712' | 'personal';
  eip712?: Eip712TypedData;
  message?: string;
  description?: string;
}

export const SIGNATURE_REQUEST_TYPE_ID = 'metro.box/signatureRequest:1.0';
export const SIGNATURE_REQUEST_TYPE_SHORT = 'signatureRequest';


export interface SignatureReferenceContent {
  requestId: string;
  signature: string;
  signer: string;
}

export const SIGNATURE_REFERENCE_TYPE_ID = 'metro.box/signatureReference:1.0';
export const SIGNATURE_REFERENCE_TYPE_SHORT = 'signatureReference';


export function mintSignatureRequestId(): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  return `sig_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function signatureRequestFallbackText(c: SignatureRequestContent): string {
  const desc = c?.description?.trim();
  return desc ? `[Signature request] ${desc}` : '[Signature request]';
}

export function signatureReferenceFallbackText(c: SignatureReferenceContent): string {
  return c?.signature ? `[Signature] ${c.signature}` : '[Signature]';
}

export function signatureRequestPreviewText(c: SignatureRequestContent): string {
  const desc = c?.description?.trim();
  return desc ? `Signature request: ${desc}` : 'Signature request';
}
export function signatureReferencePreviewText(): string {
  return 'Signature';
}
