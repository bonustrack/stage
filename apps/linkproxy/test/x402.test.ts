/** Tests for the x402 payment-challenge parser. The proxy probes a URL and, on
 *  HTTP 402, normalises the payment challenge from either the legacy JSON body
 *  (`accepts` + `maxAmountRequired`) or the v2 base64 `PAYMENT-REQUIRED` header
 *  (`amount`). These fixtures mirror the coinbase/x402 specs. */

import { describe, expect, test } from 'bun:test';

import {
  parseX402Challenge,
  challengeFrom402,
} from '../src/x402.ts';

const ENDPOINT = 'https://api.example.com/premium-data';

/** Canonical legacy/v1 402 body: exact scheme, USDC on Base. */
const V1_BODY = {
  x402Version: 1,
  error: 'X-PAYMENT header is required',
  accepts: [
    {
      scheme: 'exact',
      network: 'base',
      maxAmountRequired: '10000',
      resource: ENDPOINT,
      description: 'Access to premium market data',
      mimeType: 'application/json',
      payTo: '0x209693Bc6afc0C5328bA36FaF03C514EF312287C',
      maxTimeoutSeconds: 60,
      asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      extra: { name: 'USD Coin', version: '2' },
    },
  ],
};

function headers(map: Record<string, string> = {}) {
  const lower: Record<string, string> = {};
  for (const [k, v] of Object.entries(map)) lower[k.toLowerCase()] = v;
  return { get: (n: string) => lower[n.toLowerCase()] ?? null };
}

describe('parseX402Challenge', () => {
  test('parses a v1 body challenge and normalises the amount', () => {
    const c = parseX402Challenge(V1_BODY, ENDPOINT);
    expect(c).not.toBeNull();
    expect(c!.kind).toBe('x402');
    expect(c!.endpoint).toBe(ENDPOINT);
    expect(c!.x402Version).toBe(1);
    expect(c!.error).toBe('X-PAYMENT header is required');
    expect(c!.accepts).toHaveLength(1);
    const a = c!.accepts[0];
    expect(a).toMatchObject({
      scheme: 'exact',
      network: 'base',
      amount: '10000', // mapped from maxAmountRequired
      payTo: '0x209693Bc6afc0C5328bA36FaF03C514EF312287C',
      asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      description: 'Access to premium market data',
      maxTimeoutSeconds: 60,
    });
    expect(a.extra).toMatchObject({ name: 'USD Coin', version: '2' });
  });

  test('parses a v2 option using `amount` and CAIP-2 network', () => {
    const c = parseX402Challenge(
      {
        x402Version: 2,
        accepts: [
          {
            scheme: 'exact',
            network: 'eip155:8453',
            amount: '50000',
            asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
            payTo: '0x0000000000000000000000000000000000000001',
          },
        ],
      },
      ENDPOINT,
    );
    expect(c!.accepts[0]).toMatchObject({
      network: 'eip155:8453',
      amount: '50000',
    });
  });

  test('accepts a single inlined `accepted` option (v2)', () => {
    const c = parseX402Challenge(
      { x402Version: 2, accepted: { scheme: 'exact', network: 'base', amount: '1' } },
      ENDPOINT,
    );
    expect(c!.accepts).toHaveLength(1);
    expect(c!.accepts[0].amount).toBe('1');
  });

  test('drops malformed options but keeps valid ones', () => {
    const c = parseX402Challenge(
      {
        accepts: [
          { network: 'base' }, // no scheme -> dropped
          { scheme: 'exact', network: 'base', amount: '5' },
        ],
      },
      ENDPOINT,
    );
    expect(c!.accepts).toHaveLength(1);
    expect(c!.accepts[0].amount).toBe('5');
  });

  test('returns null for non-x402 / empty / junk', () => {
    expect(parseX402Challenge(null, ENDPOINT)).toBeNull();
    expect(parseX402Challenge({}, ENDPOINT)).toBeNull();
    expect(parseX402Challenge({ accepts: [] }, ENDPOINT)).toBeNull();
    expect(parseX402Challenge({ accepts: [{}] }, ENDPOINT)).toBeNull();
    expect(parseX402Challenge('nope', ENDPOINT)).toBeNull();
  });
});

describe('challengeFrom402', () => {
  test('prefers the JSON body when present', () => {
    const c = challengeFrom402(ENDPOINT, headers(), V1_BODY);
    expect(c!.accepts[0].scheme).toBe('exact');
  });

  test('falls back to a base64 PAYMENT-REQUIRED header', () => {
    const headerObj = {
      x402Version: 2,
      accepts: [{ scheme: 'exact', network: 'eip155:8453', amount: '7', payTo: '0xabc' }],
    };
    const b64 = Buffer.from(JSON.stringify(headerObj), 'utf-8').toString('base64');
    const c = challengeFrom402(ENDPOINT, headers({ 'PAYMENT-REQUIRED': b64 }), null);
    expect(c).not.toBeNull();
    expect(c!.accepts[0].amount).toBe('7');
    expect(c!.x402Version).toBe(2);
  });

  test('returns null when neither body nor header carry a challenge', () => {
    expect(challengeFrom402(ENDPOINT, headers(), null)).toBeNull();
    expect(challengeFrom402(ENDPOINT, headers({ 'PAYMENT-REQUIRED': 'not-base64-json' }), null)).toBeNull();
  });
});
