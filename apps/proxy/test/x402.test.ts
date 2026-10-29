import { expect, test } from 'bun:test';
import { parseX402Challenge } from '@stage-labs/client/x402';

test('parses a v1 body challenge (maxAmountRequired)', () => {
  const c = parseX402Challenge(
    {
      x402Version: 1,
      error: 'payment required',
      accepts: [{ scheme: 'exact', network: 'base', maxAmountRequired: '10000', asset: 'USDC', payTo: '0xabc' }],
    },
    'https://api.example.com/paid',
  );
  expect(c).toBeTruthy();
  expect(c.kind).toBe('x402');
  expect(c.accepts.length).toBe(1);
  expect(c.accepts[0].amount).toBe('10000');
  expect(c.accepts[0].scheme).toBe('exact');
});

test('parses a v2-style amount field', () => {
  const c = parseX402Challenge({ accepts: [{ scheme: 'exact', network: 'eip155:8453', amount: '5' }] }, 'https://x.com');
  expect(c).toBeTruthy();
  expect(c.accepts[0].amount).toBe('5');
});

test('drops options missing scheme/network', () => {
  const c = parseX402Challenge({ accepts: [{ scheme: 'exact' }, { scheme: 'exact', network: 'base', amount: '1' }] }, 'https://x.com');
  expect(c).toBeTruthy();
  expect(c.accepts.length).toBe(1);
});

test('returns null for a non-challenge object', () => {
  expect(parseX402Challenge({ foo: 'bar' }, 'https://x.com')).toBe(null);
  expect(parseX402Challenge({ accepts: [] }, 'https://x.com')).toBe(null);
  expect(parseX402Challenge(null, 'https://x.com')).toBe(null);
});
