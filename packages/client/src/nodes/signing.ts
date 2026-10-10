import { ed25519 } from '@noble/curves/ed25519';
import { sha256 } from '@noble/hashes/sha2';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils';
import { base64ToBytes, bytesToBase64 } from '../text/base64';

const SIGNATURE_SCHEME = 'stage-node-v1';
const BASE64URL = /^[A-Za-z0-9_-]*$/;
const PUBLIC_KEY_BYTES = 32;

export function base64url(bytes: Uint8Array): string {
  return bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64urlBytes(text: string): Uint8Array | null {
  if (!BASE64URL.test(text) || text.length % 4 === 1) return null;
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/');
  return base64ToBytes(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
}

export function nodeSigningText(method: string, url: string, timestamp: string, body: string | Uint8Array): string {
  const bytes = typeof body === 'string' ? utf8ToBytes(body) : body;
  return [SIGNATURE_SCHEME, method, url, timestamp, bytesToHex(sha256(bytes))].join('\n');
}

export function isStrongNodeKey(publicKey: Uint8Array): boolean {
  if (publicKey.length !== PUBLIC_KEY_BYTES) return false;
  try {
    return !ed25519.ExtendedPoint.fromHex(publicKey).isSmallOrder();
  } catch {
    return false;
  }
}
