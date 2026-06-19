import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseX402Challenge } from '../src/x402.ts';

void test('parses a v1 body challenge (maxAmountRequired)', () => {
  const c = parseX402Challenge(
    {
      x402Version: 1,
      error: 'payment required',
      accepts: [
        { scheme: 'exact', network: 'base', maxAmountRequired: '10000', asset: 'USDC', payTo: '0xabc' },
      ],
    },
    'https://api.example.com/paid',
  );
  assert.ok(c);
  assert.equal(c.kind, 'x402');
  assert.equal(c.accepts.length, 1);
  assert.equal(c.accepts[0].amount, '10000');
  assert.equal(c.accepts[0].scheme, 'exact');
});

void test('parses a v2-style amount field', () => {
  const c = parseX402Challenge(
    { accepts: [{ scheme: 'exact', network: 'eip155:8453', amount: '5' }] },
    'https://x.com',
  );
  assert.ok(c);
  assert.equal(c.accepts[0].amount, '5');
});

void test('drops options missing scheme/network', () => {
  const c = parseX402Challenge(
    { accepts: [{ scheme: 'exact' }, { scheme: 'exact', network: 'base', amount: '1' }] },
    'https://x.com',
  );
  assert.ok(c);
  assert.equal(c.accepts.length, 1);
});

void test('returns null for a non-challenge object', () => {
  assert.equal(parseX402Challenge({ foo: 'bar' }, 'https://x.com'), null);
  assert.equal(parseX402Challenge({ accepts: [] }, 'https://x.com'), null);
  assert.equal(parseX402Challenge(null, 'https://x.com'), null);
});
