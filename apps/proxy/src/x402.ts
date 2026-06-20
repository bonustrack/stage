
import {
  parseX402Challenge,
  type X402Accept,
  type X402Challenge,
} from '@stage-labs/client/x402';

export { parseX402Challenge };
export type { X402Accept, X402Challenge };

function decodeHeaderChallenge(headerVal: string): unknown {
  try {
    const bin = atob(headerVal.trim());
    const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
    const json = new TextDecoder('utf-8').decode(bytes);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

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
