import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSettleBody, settleX402 } from '../src/settle.ts';

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

// ---- SEC6/BUG5: don't replay the signed X-PAYMENT across cross-origin redirects ----

interface FetchCall { url: string; payment: string | null; }

function withFakeFetch(
  responder: (url: string) => { status: number; location?: string; body?: string },
): { calls: FetchCall[]; restore: () => void } {
  const calls: FetchCall[] = [];
  const orig = globalThis.fetch;
  // @ts-expect-error test shim for the Worker fetch
  globalThis.fetch = async (url: string, init: { headers: Record<string, string> }) => {
    const payment = init.headers['X-PAYMENT'] ?? null;
    calls.push({ url: String(url), payment });
    const r = responder(String(url));
    const headers = new Map<string, string>();
    if (r.location) headers.set('location', r.location);
    return {
      status: r.status,
      ok: r.status >= 200 && r.status < 300,
      headers: { get: (n: string) => headers.get(n.toLowerCase()) ?? null },
      body: null,
      async text() { return r.body ?? ''; },
    };
  };
  return { calls, restore: () => { globalThis.fetch = orig; } };
}

test('SEC6: does NOT replay X-PAYMENT across a cross-origin redirect', async () => {
  const { calls, restore } = withFakeFetch((url) =>
    url.startsWith('https://api.example.com')
      ? { status: 302, location: 'https://evil.attacker.com/grab' }
      : { status: 200, body: 'ok' },
  );
  try {
    await settleX402({ url: 'https://api.example.com/paid', paymentHeader: 'SIGNED-HEADER' });
    assert.equal(calls.length, 2);
    assert.equal(calls[0].payment, 'SIGNED-HEADER'); // first hop, same origin
    assert.ok(calls[1].url.startsWith('https://evil.attacker.com'));
    assert.equal(calls[1].payment, null); // cross-origin: header dropped
  } finally {
    restore();
  }
});

test('same-origin redirect still carries the header (legit paid-content hop)', async () => {
  const { calls, restore } = withFakeFetch((url) =>
    url.endsWith('/paid')
      ? { status: 302, location: 'https://api.example.com/content' }
      : { status: 200, body: 'paid content' },
  );
  try {
    const res = await settleX402({ url: 'https://api.example.com/paid', paymentHeader: 'SIGNED-HEADER' });
    assert.equal(res.status, 200);
    assert.equal(calls[0].payment, 'SIGNED-HEADER');
    assert.equal(calls[1].payment, 'SIGNED-HEADER');
  } finally {
    restore();
  }
});
