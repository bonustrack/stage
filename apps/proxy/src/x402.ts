import { base64ToBytes } from '@stage-labs/client/text/base64';
import { parseX402Challenge, type X402Challenge } from '@stage-labs/client/x402';

function decodeHeaderChallenge(headerVal: string): unknown {
  try {
    return JSON.parse(new TextDecoder('utf-8').decode(base64ToBytes(headerVal.trim())));
  } catch {
    return null;
  }
}

export function challengeFrom402(endpoint: string, headers: { get(name: string): string | null }, body: unknown): X402Challenge | null {
  const header = headers.get('payment-required');
  return parseX402Challenge(body, endpoint) ?? (header ? parseX402Challenge(decodeHeaderChallenge(header), endpoint) : null);
}
