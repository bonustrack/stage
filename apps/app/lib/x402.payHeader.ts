
import type { TypedDataDefinition, Hex } from 'viem';

import { x402ChainNumber } from './x402';
import type { X402Accept } from './useLinkPreview';

export interface X402Authorization {
  from: string;
  to: string;
  value: string;
  validAfter: string;
  validBefore: string;
  nonce: string;
}

interface X402PaymentPayload {
  x402Version: number;
  scheme: string;
  network: string;
  payload: {
    signature: string;
    authorization: X402Authorization;
  };
}

const TRANSFER_WITH_AUTHORIZATION_TYPES = {
  TransferWithAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' },
  ],
} as const;

const DEFAULT_TIMEOUT_SECONDS = 600;

export interface BuildAuthorizationParams {
  from: string;
  accept: X402Accept;
  now: number;
  nonce: string;
}

export function buildAuthorization(p: BuildAuthorizationParams): X402Authorization {
  const timeout = p.accept.maxTimeoutSeconds ?? DEFAULT_TIMEOUT_SECONDS;
  return {
    from: p.from,
    to: p.accept.payTo ?? '',
    value: p.accept.amount ?? '0',
    validAfter: '0',
    validBefore: String(p.now + timeout),
    nonce: p.nonce,
  };
}

export function buildTypedData(
  accept: X402Accept,
  authorization: X402Authorization,
): TypedDataDefinition {
  const extra = accept.extra ?? {};
  const name = typeof extra.name === 'string' ? extra.name : 'USD Coin';
  const version = typeof extra.version === 'string' ? extra.version : '2';
  const chainId = x402ChainNumber(accept.network);
  return {
    domain: {
      name,
      version,
      chainId,
      verifyingContract: (accept.asset ?? '0x0000000000000000000000000000000000000000') as Hex,
    },
    types: TRANSFER_WITH_AUTHORIZATION_TYPES,
    primaryType: 'TransferWithAuthorization',
    message: {
      from: authorization.from,
      to: authorization.to,
      value: BigInt(authorization.value),
      validAfter: BigInt(authorization.validAfter),
      validBefore: BigInt(authorization.validBefore),
      nonce: authorization.nonce,
    },
  };
}

function toBase64(s: string): string {
  if (typeof btoa === 'function') return btoa(unescape(encodeURIComponent(s)));
  const B = (globalThis as { Buffer?: { from(s: string, enc: string): { toString(enc: string): string } } }).Buffer;
  if (B) return B.from(s, 'utf-8').toString('base64');
  throw new Error('no base64 encoder');
}

export function buildPaymentHeader(args: {
  accept: X402Accept;
  authorization: X402Authorization;
  signature: string;
  x402Version?: number;
}): string {
  const payload: X402PaymentPayload = {
    x402Version: args.x402Version ?? 1,
    scheme: args.accept.scheme,
    network: args.accept.network,
    payload: {
      signature: args.signature,
      authorization: args.authorization,
    },
  };
  return toBase64(JSON.stringify(payload));
}

export function randomNonce(): string {
  const bytes = new Uint8Array(32);
  const c: Crypto | undefined = globalThis.crypto;
  if (!c?.getRandomValues) {
    throw new Error('Secure random unavailable: refusing to build a payment authorization with a weak nonce');
  }
  c.getRandomValues(bytes);
  let hex = '0x';
  for (const b of bytes) hex += b.toString(16).padStart(2, '0');
  return hex;
}
