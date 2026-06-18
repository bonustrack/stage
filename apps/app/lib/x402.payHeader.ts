/** x402 `exact` (EIP-3009 / USDC) wire-format builders — the PURE half of the
 *  pay path. No wallet, no network: just challenge -> EIP-3009 authorization ->
 *  EIP-712 typed data -> base64 X-PAYMENT header. Kept free of wagmi/viem-action
 *  imports so it's unit-testable in isolation (bun test) and the wire format
 *  (coinbase/x402 v1) can't silently drift from the spec.
 *
 *  Header shape: base64(JSON {x402Version, scheme, network, payload:{signature,
 *  authorization:{from,to,value,validAfter,validBefore,nonce}}}). */

import type { TypedDataDefinition, Hex } from 'viem';

import { x402ChainNumber } from './x402';
import type { X402Accept } from './useLinkPreview';

/** The EIP-3009 `transferWithAuthorization` authorization tuple, as it appears
 *  in the X-PAYMENT payload. All numeric fields are decimal strings (atomic
 *  units / unix seconds) and `nonce` is a 0x-prefixed 32-byte hex string. */
export interface X402Authorization {
  from: string;
  to: string;
  value: string;
  validAfter: string;
  validBefore: string;
  nonce: string;
}

/** The decoded X-PAYMENT header body (before base64). */
interface X402PaymentPayload {
  x402Version: number;
  scheme: string;
  network: string;
  payload: {
    signature: string;
    authorization: X402Authorization;
  };
}

/** EIP-3009 typed-data `types` block — `TransferWithAuthorization` is the gasless
 *  transfer permit USDC (and other EIP-3009 tokens) implement. */
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

/** Default authorization window (seconds) when the challenge omits a timeout. */
const DEFAULT_TIMEOUT_SECONDS = 600;

/** Inputs needed to build the EIP-3009 authorization for an `exact` challenge. */
export interface BuildAuthorizationParams {
  /** The payer (active wallet) address. */
  from: string;
  /** The challenge accept (scheme/network/asset/amount/payTo/extra/timeout). */
  accept: X402Accept;
  /** Unix seconds "now" — injectable so tests are deterministic. */
  now: number;
  /** 32-byte 0x nonce — injectable so tests are deterministic. */
  nonce: string;
}

/** Build the EIP-3009 authorization message from a challenge accept + payer.
 *  Pure: deterministic given (from, accept, now, nonce). */
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

/** Build the EIP-712 typed-data definition for the EIP-3009 transfer. The domain
 *  name/version come from the challenge's `extra` (USDC carries name "USD Coin"
 *  / version "2"); `verifyingContract` is the asset (token) address. Pure. */
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

/** base64-encode a UTF-8 string. RN has global `btoa`; fall back to Buffer so
 *  this works under the test runner and any environment. */
function toBase64(s: string): string {
  if (typeof btoa === 'function') return btoa(unescape(encodeURIComponent(s)));
  const B = (globalThis as { Buffer?: { from(s: string, enc: string): { toString(enc: string): string } } }).Buffer;
  if (B) return B.from(s, 'utf-8').toString('base64');
  throw new Error('no base64 encoder');
}

/** Build the base64 X-PAYMENT header from a signed authorization. Pure given its
 *  inputs — unit-tested against a fixture challenge so the wire format is locked
 *  to the coinbase/x402 v1 spec. */
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

/** Generate a random 32-byte 0x nonce for the authorization. Uses the RN crypto
 *  polyfill (`crypto.getRandomValues`, installed app-wide).
 *
 *  The nonce is the only replay protection on an EIP-3009 transfer
 *  authorization: a predictable nonce lets an attacker collide / replay the
 *  signed authorization. `Math.random()` is not a CSPRNG, so if
 *  `crypto.getRandomValues` is somehow absent we THROW rather than sign a
 *  transfer behind a weak nonce. */
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
