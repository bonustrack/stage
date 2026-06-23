import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSettleBody, settleX402 } from '../src/settle.ts';

void test('parseSettleBody accepts a valid body', () => {
  const r = parseSettleBody({ url: 'https://api.example.com/paid', paymentHeader: 'abc123' });
  assert.deepEqual(r, { url: 'https://api.example.com/paid', paymentHeader: 'abc123' });
});

void test('parseSettleBody trims whitespace', () => {
  const r = parseSettleBody({ url: '  https://x.com  ', paymentHeader: '  h  ' });
  assert.deepEqual(r, { url: 'https://x.com', paymentHeader: 'h' });
});

void test('parseSettleBody rejects missing fields', () => {
  assert.equal(parseSettleBody({ url: 'https://x.com' }), null);
  assert.equal(parseSettleBody({ paymentHeader: 'h' }), null);
  assert.equal(parseSettleBody({ url: '', paymentHeader: 'h' }), null);
  assert.equal(parseSettleBody({ url: 'https://x.com', paymentHeader: '' }), null);
});

void test('parseSettleBody rejects non-objects', () => {
  assert.equal(parseSettleBody(null), null);
  assert.equal(parseSettleBody('str'), null);
  assert.equal(parseSettleBody(42), null);
});


interface FetchCall { url: string; payment: string | null; }

function withFakeFetch(
  responder: (url: string) => { status: number; location?: string; body?: string },
): { calls: FetchCall[]; restore: () => void } {
  const calls: FetchCall[] = [];
  const orig = globalThis.fetch;
  const shim = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const headers = (init?.headers ?? {}) as Record<string, string>;
    const payment = headers['X-PAYMENT'] ?? null;
    calls.push({ url, payment });
    const r = responder(url);
    const resHeaders = new Map<string, string>();
    if (r.location) resHeaders.set('location', r.location);
    const fake = {
      status: r.status,
      ok: r.status >= 200 && r.status < 300,
      headers: { get: (n: string) => resHeaders.get(n.toLowerCase()) ?? null },
      body: null,
      text: () => Promise.resolve(r.body ?? ''),
    };
    return Promise.resolve(fake as unknown as Response);
  };
  globalThis.fetch = shim;
  return { calls, restore: () => { globalThis.fetch = orig; } };
}

void test('SEC6: does NOT replay X-PAYMENT across a cross-origin redirect', async () => {
  const { calls, restore } = withFakeFetch((url) =>
    url.startsWith('https://api.example.com')
      ? { status: 302, location: 'https://evil.attacker.com/grab' }
      : { status: 200, body: 'ok' },
  );
  try {
    await settleX402({ url: 'https://api.example.com/paid', paymentHeader: 'SIGNED-HEADER' });
    assert.equal(calls.length, 2);
    const [first, second] = calls;
    assert.ok(first);
    assert.ok(second);
    assert.equal(first.payment, 'SIGNED-HEADER');
    assert.ok(second.url.startsWith('https://evil.attacker.com'));
    assert.equal(second.payment, null);
  } finally {
    restore();
  }
});

void test('same-origin redirect still carries the header (legit paid-content hop)', async () => {
  const { calls, restore } = withFakeFetch((url) =>
    url.endsWith('/paid')
      ? { status: 302, location: 'https://api.example.com/content' }
      : { status: 200, body: 'paid content' },
  );
  try {
    const res = await settleX402({ url: 'https://api.example.com/paid', paymentHeader: 'SIGNED-HEADER' });
    assert.equal(res.status, 200);
    const [first, second] = calls;
    assert.ok(first);
    assert.ok(second);
    assert.equal(first.payment, 'SIGNED-HEADER');
    assert.equal(second.payment, 'SIGNED-HEADER');
  } finally {
    restore();
  }
});
