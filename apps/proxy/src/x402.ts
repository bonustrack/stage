import { base64ToBytes } from '@stage-labs/client/text/base64';
import { parseX402Challenge, type X402Challenge } from '@stage-labs/client/x402';

function decodeHeaderChallenge(headerVal: string): unknown {
  try {
    return JSON.parse(new TextDecoder('utf-8').decode(base64ToBytes(headerVal.trim())));
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
