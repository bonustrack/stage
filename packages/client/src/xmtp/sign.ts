

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

export function buildPersonalSignatureRequest(
  message: string, description?: string,
): SignatureRequestContent {
  const msg = message.trim();
  if (!msg) throw new Error('Enter a message to sign');
  const desc = description?.trim();
  return { id: mintSignatureRequestId(), kind: 'personal', message: msg, ...(desc ? { description: desc } : {}) };
}

export function buildEip712SignatureRequest(
  json: string, description?: string,
): SignatureRequestContent {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('Typed-data JSON is not valid JSON');
  }
  const td = parsed as { domain?: unknown; types?: unknown; primaryType?: unknown; message?: unknown };
  if (!td || typeof td !== 'object' || !td.types || !td.primaryType || !td.message) {
    throw new Error('Typed data needs `types`, `primaryType`, and `message` fields');
  }
  const desc = description?.trim();
  return {
    id: mintSignatureRequestId(),
    kind: 'eip712',
    eip712: {
      domain: (td.domain ?? {}) as Record<string, unknown>,
      types: td.types as Record<string, { name: string; type: string }[]>,
      primaryType: td.primaryType as string,
      message: td.message as Record<string, unknown>,
    },
    ...(desc ? { description: desc } : {}),
  };
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

export interface SignTypedDataInput {
  domain: Record<string, unknown>;
  types: Record<string, { name: string; type: string }[]>;
  primaryType: string;
  message: Record<string, unknown>;
}

export function typedDataForRequest(req: SignatureRequestContent): SignTypedDataInput {
  const td = req.eip712;
  if (!td) throw new Error('Malformed typed-data request');
  const types = { ...td.types };
  delete types.EIP712Domain;
  return { domain: td.domain, types, primaryType: td.primaryType, message: td.message };
}

export function personalMessageForRequest(req: SignatureRequestContent): string {
  const message = req.message ?? '';
  if (!message) throw new Error('Empty message to sign');
  return message;
}

export function buildSignatureReference(
  requestId: string, signature: string, signer: string,
): SignatureReferenceContent {
  if (!requestId) throw new Error('Signature reference is missing its request id');
  if (!signature) throw new Error('Signature reference is missing the signature');
  if (!signer) throw new Error('Signature reference is missing the signer address');
  return { requestId, signature, signer };
}
