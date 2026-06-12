/** Tests for the x402 `exact` X-PAYMENT header construction. The wire format
 *  (coinbase/x402 v1: base64(JSON {x402Version,scheme,network,payload:
 *  {signature,authorization}})) is what a resource server's facilitator parses,
 *  so a silent drift here breaks every payment. We pin it with a fixture
 *  challenge + fixed nonce/now (everything but the signature is deterministic). */

import { describe, expect, test } from 'bun:test';
import {
  buildAuthorization,
  buildTypedData,
  buildPaymentHeader,
} from '../lib/x402.payHeader';
import type { X402Accept } from '../lib/useLinkPreview';

const FIXTURE_ACCEPT: X402Accept = {
  scheme: 'exact',
  network: 'eip155:8453',
  asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC on Base
  amount: '10000', // 0.01 USDC (6 decimals)
  payTo: '0x1234567890123456789012345678901234567890',
  description: 'API access',
  maxTimeoutSeconds: 600,
  extra: { name: 'USD Coin', version: '2' },
};

const FROM = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';
const NOW = 1_700_000_000;
const NONCE = '0x' + '11'.repeat(32);

describe('buildAuthorization', () => {
  test('maps challenge + payer into the EIP-3009 authorization', () => {
    const auth = buildAuthorization({ from: FROM, accept: FIXTURE_ACCEPT, now: NOW, nonce: NONCE });
    expect(auth).toEqual({
      from: FROM,
      to: FIXTURE_ACCEPT.payTo!,
      value: '10000',
      validAfter: '0',
      validBefore: String(NOW + 600),
      nonce: NONCE,
    });
  });

  test('defaults the timeout to 600s when the challenge omits it', () => {
    const auth = buildAuthorization({
      from: FROM,
      accept: { ...FIXTURE_ACCEPT, maxTimeoutSeconds: undefined },
      now: NOW,
      nonce: NONCE,
    });
    expect(auth.validBefore).toBe(String(NOW + 600));
  });
});

describe('buildTypedData', () => {
  test('domain from extra + asset; EIP-3009 primaryType + types', () => {
    const auth = buildAuthorization({ from: FROM, accept: FIXTURE_ACCEPT, now: NOW, nonce: NONCE });
    const td = buildTypedData(FIXTURE_ACCEPT, auth);
    expect(td.primaryType).toBe('TransferWithAuthorization');
    expect(td.domain).toMatchObject({
      name: 'USD Coin',
      version: '2',
      chainId: 8453,
      verifyingContract: FIXTURE_ACCEPT.asset,
    });
    // bigint-coerced message fields
    expect((td.message as Record<string, unknown>).value).toBe(BigInt(10000));
    expect((td.message as Record<string, unknown>).validAfter).toBe(BigInt(0));
    expect((td.message as Record<string, unknown>).nonce).toBe(NONCE);
  });

  test('falls back to USD Coin / version 2 when extra is missing', () => {
    const td = buildTypedData(
      { ...FIXTURE_ACCEPT, extra: undefined },
      buildAuthorization({ from: FROM, accept: FIXTURE_ACCEPT, now: NOW, nonce: NONCE }),
    );
    expect(td.domain).toMatchObject({ name: 'USD Coin', version: '2' });
  });
});

describe('buildPaymentHeader', () => {
  const SIGNATURE = '0x' + 'ab'.repeat(65);

  test('produces a deterministic base64 X-PAYMENT header (sans signature variance)', () => {
    const auth = buildAuthorization({ from: FROM, accept: FIXTURE_ACCEPT, now: NOW, nonce: NONCE });
    const header = buildPaymentHeader({ accept: FIXTURE_ACCEPT, authorization: auth, signature: SIGNATURE });

    const decoded = JSON.parse(Buffer.from(header, 'base64').toString('utf-8'));
    expect(decoded).toEqual({
      x402Version: 1,
      scheme: 'exact',
      network: 'eip155:8453',
      payload: {
        signature: SIGNATURE,
        authorization: {
          from: FROM,
          to: FIXTURE_ACCEPT.payTo,
          value: '10000',
          validAfter: '0',
          validBefore: String(NOW + 600),
          nonce: NONCE,
        },
      },
    });
  });

  test('header is byte-for-byte stable for the same inputs', () => {
    const auth = buildAuthorization({ from: FROM, accept: FIXTURE_ACCEPT, now: NOW, nonce: NONCE });
    const a = buildPaymentHeader({ accept: FIXTURE_ACCEPT, authorization: auth, signature: SIGNATURE });
    const b = buildPaymentHeader({ accept: FIXTURE_ACCEPT, authorization: auth, signature: SIGNATURE });
    expect(a).toBe(b);
  });

  test('honours an explicit x402Version', () => {
    const auth = buildAuthorization({ from: FROM, accept: FIXTURE_ACCEPT, now: NOW, nonce: NONCE });
    const header = buildPaymentHeader({ accept: FIXTURE_ACCEPT, authorization: auth, signature: SIGNATURE, x402Version: 2 });
    const decoded = JSON.parse(Buffer.from(header, 'base64').toString('utf-8'));
    expect(decoded.x402Version).toBe(2);
  });
});
