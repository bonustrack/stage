import { afterEach, describe, expect, test } from 'bun:test';
import { bytesToBase64 } from '@stage-labs/client/text/base64';
import { fetchPage } from '../src/fetchPage.ts';
import { restoreFetch, stubFetch } from './fakeFetch.ts';

const PAID = 'https://api.example.com/paid';
const ACCEPT = { scheme: 'exact', network: 'base', maxAmountRequired: '10000', asset: 'USDC', payTo: '0xabc' };
const HEADER_ACCEPT = { scheme: 'exact', network: 'eip155:8453', amount: '5' };

const encodedHeader = (value: unknown): string => bytesToBase64(new TextEncoder().encode(JSON.stringify(value)));

function answer402(init: { body?: unknown; contentType?: string; header?: string }): void {
  stubFetch(() => {
    const headers: Record<string, string> = { 'content-type': init.contentType ?? 'application/json' };
    if (init.header !== undefined) headers['payment-required'] = init.header;
    return new Response(init.body === undefined ? null : JSON.stringify(init.body), { status: 402, headers });
  });
}

afterEach(restoreFetch);

describe('a 402 link preview', () => {
  test('reads the challenge from a JSON body', async () => {
    answer402({ body: { x402Version: 1, accepts: [ACCEPT] } });
    expect(await fetchPage(PAID)).toMatchObject({
      kind: 'x402',
      endpoint: PAID,
      accepts: [{ scheme: 'exact', network: 'base', amount: '10000' }],
    });
  });

  test('names the page the redirects ended on as the endpoint', async () => {
    stubFetch((request) =>
      request.url === PAID
        ? new Response(null, { status: 302, headers: { location: '/checkout' } })
        : Response.json({ accepts: [ACCEPT] }, { status: 402 }),
    );
    expect(await fetchPage(PAID)).toMatchObject({ endpoint: 'https://api.example.com/checkout' });
  });

  test('reads the base64 payment-required header when the body is not a challenge', async () => {
    answer402({ body: 'pay first', contentType: 'text/plain', header: ` ${encodedHeader({ accepts: [HEADER_ACCEPT] })} ` });
    expect(await fetchPage(PAID)).toMatchObject({ kind: 'x402', accepts: [{ network: 'eip155:8453', amount: '5' }] });
  });

  test('prefers the body challenge over the header', async () => {
    answer402({ body: { accepts: [ACCEPT] }, header: encodedHeader({ accepts: [HEADER_ACCEPT] }) });
    expect(await fetchPage(PAID)).toMatchObject({ accepts: [{ network: 'base' }] });
  });

  test('is no preview when neither the body nor the header holds a challenge', async () => {
    answer402({ body: { error: 'payment required' }, header: 'not base64 json' });
    expect(await fetchPage(PAID)).toBeNull();
    answer402({});
    expect(await fetchPage(PAID)).toBeNull();
  });
});
