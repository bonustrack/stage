
import { afterEach, describe, expect, test } from 'bun:test';
import { fetchUsdPrice, fmtUsdValue } from '../src/wallet/prices';

const realFetch = globalThis.fetch;
let requests: string[] = [];

function respond(id: string, price: number | null, status = 200): void {
  globalThis.fetch = (input) => {
    requests.push(decodeURIComponent(String(input)));
    const coins = price === null ? {} : { [id]: { price, timestamp: Math.floor(Date.now() / 1000), confidence: 0.99 } };
    return Promise.resolve(Response.json({ coins }, { status }));
  };
}

afterEach(() => { globalThis.fetch = realFetch; requests = []; });

describe('fetchUsdPrice', () => {
  test('reads the DefiLlama quote and caches it', async () => {
    const id = 'base:0x0000000000000000000000000000000000000001';
    respond(id, 2500);
    expect(await fetchUsdPrice(id)).toBe(2500);
    expect(await fetchUsdPrice(id)).toBe(2500);
    expect(requests).toEqual([`https://coins.llama.fi/prices/current/${id}`]);
  });
  test('an API error gives null, not a crash', async () => {
    const id = 'base:0x0000000000000000000000000000000000000002';
    respond(id, 2500, 503);
    expect(await fetchUsdPrice(id)).toBeNull();
  });
  test('a missing quote gives null', async () => {
    const id = 'base:0x0000000000000000000000000000000000000003';
    respond(id, null);
    expect(await fetchUsdPrice(id)).toBeNull();
  });
  test('no price id -> null without a request', async () => {
    respond('', 1);
    expect(await fetchUsdPrice(null)).toBeNull();
    expect(requests).toEqual([]);
  });
});

describe('fmtUsdValue', () => {
  test('null price -> null (amount only)', () => {
    expect(fmtUsdValue('50', null)).toBeNull();
  });
  test('0.1 ETH @ $3500 -> ~$350', () => {
    expect(fmtUsdValue('0.1', 3500)).toBe('~$350');
  });
  test('sub-cent value -> ~<$0.01, never ~$0', () => {
    expect(fmtUsdValue('0.000001', 1)).toBe('~<$0.01');
  });
  test('zero amount -> null', () => {
    expect(fmtUsdValue('0', 3500)).toBeNull();
  });
  test('< $1 keeps more precision', () => {
    expect(fmtUsdValue('0.0001', 3500)).toBe('~$0.35');
  });
});
