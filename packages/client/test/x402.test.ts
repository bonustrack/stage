
import { describe, expect, test } from 'bun:test';
import { parseX402Challenge, normaliseAccept } from '../src/x402/challenge';

function assertPresent<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error('expected a value, got null/undefined');
  return value;
}

describe('parseX402Challenge', () => {
  test('v1 body: maxAmountRequired -> amount', () => {
    const c = parseX402Challenge(
      {
        x402Version: 1,
        error: 'payment required',
        accepts: [{ scheme: 'exact', network: 'base', maxAmountRequired: '10000', asset: 'USDC', payTo: '0xabc' }],
      },
      'https://api.example.com/paid',
    );
    expect(c).not.toBeNull();
    const ch = assertPresent(c);
    expect(ch.kind).toBe('x402');
    expect(ch.accepts).toHaveLength(1);
    expect(assertPresent(ch.accepts[0]).amount).toBe('10000');
    expect(ch.x402Version).toBe(1);
  });

  test('v2: amount field + inlined `accepted` single option', () => {
    const c = parseX402Challenge(
      { accepted: { scheme: 'exact', network: 'eip155:8453', amount: '5' } },
      'https://x.com',
    );
    expect(assertPresent(assertPresent(c).accepts[0]).amount).toBe('5');
  });

  test('an embedded endpoint is used only when it is https on the same origin as the fetched URL', () => {
    const accepts = [{ scheme: 'exact', network: 'base' }];
    const sameOrigin = parseX402Challenge({ endpoint: 'https://api.example/paid', accepts }, 'https://api.example/start');
    expect(assertPresent(sameOrigin).endpoint).toBe('https://api.example/paid');
    const elsewhere = parseX402Challenge({ endpoint: 'https://evil.example/paid', accepts }, 'https://api.example/start');
    expect(assertPresent(elsewhere).endpoint).toBe('https://api.example/start');
    const plainHttp = parseX402Challenge({ endpoint: 'http://api.example/paid', accepts }, 'https://api.example/start');
    expect(assertPresent(plainHttp).endpoint).toBe('https://api.example/start');
    const script = parseX402Challenge({ endpoint: 'javascript:alert(1)', accepts }, 'https://api.example/start');
    expect(assertPresent(script).endpoint).toBe('https://api.example/start');
  });

  test('drops options missing scheme/network; null when none remain', () => {
    expect(parseX402Challenge({ accepts: [{ amount: '5' }] }, 'x')).toBeNull();
    const c = parseX402Challenge(
      { accepts: [{ amount: '5' }, { scheme: 'exact', network: 'base', amount: '5' }] },
      'x',
    );
    expect(assertPresent(c).accepts).toHaveLength(1);
  });

  test('returns null for non-object / empty', () => {
    expect(parseX402Challenge(null, 'x')).toBeNull();
    expect(parseX402Challenge({ accepts: [] }, 'x')).toBeNull();
  });
});

describe('normaliseAccept', () => {
  test('keeps extra only when an object', () => {
    expect(assertPresent(normaliseAccept({ scheme: 'exact', network: 'base', extra: { name: 'USDC' } })).extra).toEqual({ name: 'USDC' });
    expect(assertPresent(normaliseAccept({ scheme: 'exact', network: 'base', extra: 'no' })).extra).toBeUndefined();
  });
});
