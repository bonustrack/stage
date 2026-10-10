import { sha256 } from '@noble/hashes/sha2';
import { bytesToHex } from '@noble/hashes/utils';
import { base64urlBytes } from './signing';

const NODES_ORIGIN = 'https://nodes.stage.box';
export const NODE_PUBLISH_PATH = '/nodes';
export const NODE_CODE_MAX_BYTES = 64 * 1024;
export const NODE_REPLY_MAX_BYTES = 128 * 1024;
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
