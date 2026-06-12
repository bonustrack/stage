/** x402 payment-challenge detection for the link-preview proxy.
 *
 *  x402 (coinbase/x402) reactivates HTTP 402 Payment Required: a server that
 *  wants payment for a resource answers with `402` and a machine-readable
 *  payment challenge. The proxy probes a URL and, when it gets a 402 challenge,
 *  surfaces it to the app so the chat can render an x402 payment card instead of
 *  (or alongside) an OpenGraph preview.
 *
 *  The wire-format type + the body/option parser live in @stage-labs/client
 *  (`x402/challenge`) so the proxy and the app share ONE definition and can't
 *  drift. This module keeps only the proxy-specific glue: decoding the v2
 *  `PAYMENT-REQUIRED` header and merging body-vs-header sources. */

import {
  parseX402Challenge,
  type X402Accept,
  type X402Challenge,
} from '@stage-labs/client/x402';

export { parseX402Challenge };
export type { X402Accept, X402Challenge };

/** Decode a base64 `PAYMENT-REQUIRED` header value into a challenge object.
 *  Returns null on bad base64 / bad JSON. */
function decodeHeaderChallenge(headerVal: string): unknown {
  try {
    // Workers runtime: use atob (no Node Buffer). base64 -> bytes -> UTF-8 so
    // multi-byte challenge text survives.
    const bin = atob(headerVal.trim());
    const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
    const json = new TextDecoder('utf-8').decode(bytes);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/** Given a 402 response's headers + JSON body (already parsed, or null), build a
 *  normalised challenge. Prefers the body `accepts` (legacy/most common), falls
 *  back to the v2 `PAYMENT-REQUIRED` header. Returns null if neither parses. */
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
