import { afterEach, expect, test } from 'bun:test';
import { parseSettleBody, settleX402 } from '../src/settle.ts';
import { restoreFetch, stubFetch } from './fakeFetch.ts';

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

function withFakeFetch(responder: (url: string) => { status: number; location?: string; body?: string }): FetchCall[] {
  const calls: FetchCall[] = [];
  stubFetch((request) => {
    calls.push({ url: request.url, payment: request.headers.get('X-PAYMENT') });
    const { status, location, body } = responder(request.url);
    return new Response(body ?? null, { status, headers: location === undefined ? {} : { location } });
  });
  return calls;
}

afterEach(restoreFetch);

test('SEC6: does NOT replay X-PAYMENT across a cross-origin redirect', async () => {
  const calls = withFakeFetch((url) =>
    url.startsWith('https://api.example.com') ? { status: 302, location: 'https://evil.attacker.com/grab' } : { status: 200, body: 'ok' },
  );
  await settleX402({ url: 'https://api.example.com/paid', paymentHeader: 'SIGNED-HEADER' });
  expect(calls.map(({ url, payment }) => [new URL(url).origin, payment])).toEqual([
    ['https://api.example.com', 'SIGNED-HEADER'],
    ['https://evil.attacker.com', null],
  ]);
});

test('same-origin redirect still carries the header (legit paid-content hop)', async () => {
  const calls = withFakeFetch((url) =>
    url.endsWith('/paid') ? { status: 302, location: 'https://api.example.com/content' } : { status: 200, body: 'paid content' },
  );
  const res = await settleX402({ url: 'https://api.example.com/paid', paymentHeader: 'SIGNED-HEADER' });
  expect(res.status).toBe(200);
  expect(calls.map(({ payment }) => payment)).toEqual(['SIGNED-HEADER', 'SIGNED-HEADER']);
});
