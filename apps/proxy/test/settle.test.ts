import { expect, test } from 'bun:test';
import { parseSettleBody, settleX402 } from '../src/settle.ts';

test('parseSettleBody accepts a valid body', () => {
  const r = parseSettleBody({ url: 'https://api.example.com/paid', paymentHeader: 'abc123' });
  expect(r).toStrictEqual({ url: 'https://api.example.com/paid', paymentHeader: 'abc123' });
});

test('parseSettleBody trims whitespace', () => {
  const r = parseSettleBody({ url: '  https://x.com  ', paymentHeader: '  h  ' });
  expect(r).toStrictEqual({ url: 'https://x.com', paymentHeader: 'h' });
});

test('parseSettleBody rejects missing fields', () => {
  expect(parseSettleBody({ url: 'https://x.com' })).toBe(null);
  expect(parseSettleBody({ paymentHeader: 'h' })).toBe(null);
  expect(parseSettleBody({ url: '', paymentHeader: 'h' })).toBe(null);
  expect(parseSettleBody({ url: 'https://x.com', paymentHeader: '' })).toBe(null);
});

test('parseSettleBody rejects non-objects', () => {
  expect(parseSettleBody(null)).toBe(null);
  expect(parseSettleBody('str')).toBe(null);
  expect(parseSettleBody(42)).toBe(null);
});

interface FetchCall {
  url: string;
  payment: string | null;
}

function withFakeFetch(responder: (url: string) => { status: number; location?: string; body?: string }): {
  calls: FetchCall[];
  restore: () => void;
} {
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
  return {
    calls,
    restore: () => {
      globalThis.fetch = orig;
    },
  };
}

test('SEC6: does NOT replay X-PAYMENT across a cross-origin redirect', async () => {
  const { calls, restore } = withFakeFetch((url) =>
    url.startsWith('https://api.example.com') ? { status: 302, location: 'https://evil.attacker.com/grab' } : { status: 200, body: 'ok' },
  );
  try {
    await settleX402({ url: 'https://api.example.com/paid', paymentHeader: 'SIGNED-HEADER' });
    expect(calls.length).toBe(2);
    const [first, second] = calls;
    expect(first).toBeTruthy();
    expect(second).toBeTruthy();
    expect(first.payment).toBe('SIGNED-HEADER');
    expect(second.url.startsWith('https://evil.attacker.com')).toBeTruthy();
    expect(second.payment).toBe(null);
  } finally {
    restore();
  }
});

test('same-origin redirect still carries the header (legit paid-content hop)', async () => {
  const { calls, restore } = withFakeFetch((url) =>
    url.endsWith('/paid') ? { status: 302, location: 'https://api.example.com/content' } : { status: 200, body: 'paid content' },
  );
  try {
    const res = await settleX402({ url: 'https://api.example.com/paid', paymentHeader: 'SIGNED-HEADER' });
    expect(res.status).toBe(200);
    const [first, second] = calls;
    expect(first).toBeTruthy();
    expect(second).toBeTruthy();
    expect(first.payment).toBe('SIGNED-HEADER');
    expect(second.payment).toBe('SIGNED-HEADER');
  } finally {
    restore();
  }
});
