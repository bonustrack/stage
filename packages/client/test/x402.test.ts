/** Tests for the shared x402 challenge parser (SIMP1). This is the single
 *  source of truth imported by both the link-preview proxy and the app, so it
 *  must accept both v1 (`maxAmountRequired`) and v2 (`amount`) wire shapes and
 *  degrade gracefully on junk. */

import { describe, expect, test } from 'bun:test';
import { parseX402Challenge, normaliseAccept } from '../src/x402/challenge';

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
    expect(c!.kind).toBe('x402');
    expect(c!.accepts).toHaveLength(1);
    expect(c!.accepts[0].amount).toBe('10000');
    expect(c!.x402Version).toBe(1);
  });

  test('v2: amount field + inlined `accepted` single option', () => {
    const c = parseX402Challenge(
      { accepted: { scheme: 'exact', network: 'eip155:8453', amount: '5' } },
      'https://x.com',
    );
    expect(c!.accepts[0].amount).toBe('5');
  });

  test('prefers an embedded endpoint over the fallback', () => {
    const c = parseX402Challenge(
      { endpoint: 'https://real/paid', accepts: [{ scheme: 'exact', network: 'base' }] },
      'https://fallback',
    );
    expect(c!.endpoint).toBe('https://real/paid');
  });

  test('drops options missing scheme/network; null when none remain', () => {
    expect(parseX402Challenge({ accepts: [{ amount: '5' }] }, 'x')).toBeNull();
    const c = parseX402Challenge(
      { accepts: [{ amount: '5' }, { scheme: 'exact', network: 'base', amount: '5' }] },
      'x',
    );
    expect(c!.accepts).toHaveLength(1);
  });

  test('returns null for non-object / empty', () => {
    expect(parseX402Challenge(null, 'x')).toBeNull();
    expect(parseX402Challenge({ accepts: [] }, 'x')).toBeNull();
  });
});

describe('normaliseAccept', () => {
  test('keeps extra only when an object', () => {
    expect(normaliseAccept({ scheme: 'exact', network: 'base', extra: { name: 'USDC' } })!.extra).toEqual({ name: 'USDC' });
    expect(normaliseAccept({ scheme: 'exact', network: 'base', extra: 'no' })!.extra).toBeUndefined();
  });
});
