/** @file Normalizes an HTTP 402 x402 payment challenge from the response body or the v2 PAYMENT-REQUIRED header into a shared X402Challenge. */

import {
  parseX402Challenge,
  type X402Accept,
  type X402Challenge,
} from '@stage-labs/client/x402';

export { parseX402Challenge };
export type { X402Accept, X402Challenge };

/** Decode a base64 `PAYMENT-REQUIRED` header value into a challenge object. Returns null on bad base64 / bad JSON. */
function decodeHeaderChallenge(headerVal: string): unknown {
  try {
    /** Workers runtime: use atob (no Node Buffer), decoding base64 -> bytes -> UTF-8 so multi-byte challenge text survives. */
    const bin = atob(headerVal.trim());
    const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
    const json = new TextDecoder('utf-8').decode(bytes);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/** Given a 402 response's headers + JSON body (already parsed, or null), build a normalised challenge. Prefers the body `accepts` (legacy/most common), falls back to the v2 `PAYMENT-REQUIRED` header. Returns null if neither parses. */
export function challengeFrom402(
  endpoint: string,
  headers: { get(name: string): string | null },
  body: unknown,
): X402Challenge | null {
  const fromBody = parseX402Challenge(body, endpoint);
  if (fromBody) return fromBody;
  const hdr = headers.get('payment-required');
  if (hdr) {
    const decoded = decodeHeaderChallenge(hdr);
    const fromHeader = parseX402Challenge(decoded, endpoint);
    if (fromHeader) return fromHeader;
  }
  return null;
}
