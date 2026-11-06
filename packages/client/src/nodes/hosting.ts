import { sha256 } from '@noble/hashes/sha2';
import { bytesToHex } from '@noble/hashes/utils';
import { base64urlBytes } from './signing';

export const NODES_HOST = 'nodes.stage.box';
const NODES_ORIGIN = `https://${NODES_HOST}`;
export const NODE_CODE_MAX_BYTES = 64 * 1024;
export const NODE_REPLY_MAX_BYTES = 128 * 1024;
export const NODE_REQUEST_MAX_BYTES = 64 * 1024;
export const NODE_LIMITS = { cpuMs: 50, subRequests: 5 } as const;
export const NODE_TIMEOUT_MS = 10_000;
export const NODE_SIGNATURE_MAX_SKEW_SECONDS = 300;
export const NODE_SIGNATURE_HEADERS = { key: 'Stage-Key', timestamp: 'Stage-Timestamp', signature: 'Stage-Signature' } as const;
export const NODE_CAPABILITIES_HEADER = 'Stage-A2UI-Capabilities';
export const NODE_PUBLISH_STATUS = { refused: 400, 'too-large': 413, busy: 429, 'not-ready': 503, full: 507 } as const;
const NODE_ID = /^[0-9a-f]{32}$/;
const PUBLIC_KEY_BYTES = 32;

export function nodeIdOf(keyId: string): string | null {
  const publicKey = base64urlBytes(keyId);
  return publicKey?.length === PUBLIC_KEY_BYTES ? bytesToHex(sha256(publicKey)).slice(0, 32) : null;
}

export function isNodeId(id: string): boolean {
  return NODE_ID.test(id);
}

export function nodeScriptName(id: string): string {
  return `node-${id}`;
}

export function hostedNodeUrl(id: string): string {
  return `${NODES_ORIGIN}/${id}`;
}

function ipv6Groups(address: string): string[] {
  const [head = '', tail] = address.split('::');
  const left = head === '' ? [] : head.split(':');
  const right = tail === undefined || tail === '' ? [] : tail.split(':');
  const gap = tail === undefined ? 0 : Math.max(0, 8 - left.length - right.length);
  return [...left, ...Array.from({ length: gap }, () => '0'), ...right];
}

export function clientRateKey(ip: string): string {
  const address = ip.trim().toLowerCase();
  if (!address.includes(':')) return address;
  if (address.includes('.')) return address.slice(address.lastIndexOf(':') + 1);
  return `${ipv6Groups(address)
    .slice(0, 4)
    .map((group) => group.replace(/^0+(?=.)/, ''))
    .join(':')}::/64`;
}
