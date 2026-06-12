import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSettleBody } from '../src/settle.ts';

test('parseSettleBody accepts a valid body', () => {
  const r = parseSettleBody({ url: 'https://api.example.com/paid', paymentHeader: 'abc123' });
  assert.deepEqual(r, { url: 'https://api.example.com/paid', paymentHeader: 'abc123' });
});

test('parseSettleBody trims whitespace', () => {
  const r = parseSettleBody({ url: '  https://x.com  ', paymentHeader: '  h  ' });
  assert.deepEqual(r, { url: 'https://x.com', paymentHeader: 'h' });
});

test('parseSettleBody rejects missing fields', () => {
  assert.equal(parseSettleBody({ url: 'https://x.com' }), null);
  assert.equal(parseSettleBody({ paymentHeader: 'h' }), null);
  assert.equal(parseSettleBody({ url: '', paymentHeader: 'h' }), null);
  assert.equal(parseSettleBody({ url: 'https://x.com', paymentHeader: '' }), null);
});

test('parseSettleBody rejects non-objects', () => {
  assert.equal(parseSettleBody(null), null);
  assert.equal(parseSettleBody('str'), null);
  assert.equal(parseSettleBody(42), null);
});
