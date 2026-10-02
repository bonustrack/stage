import { afterEach, describe, expect, test } from 'bun:test';
import { getCurrentPrices, getPriceChanges } from '../src/api/defillama';

const realFetch = globalThis.fetch;
const eth = 'ethereum:0x0000000000000000000000000000000000000000';
const btc = 'bitcoin:btc';
const now = Math.floor(Date.now() / 1000);
const quote = { price: 4000, timestamp: now, confidence: 0.99 };
let requests: string[] = [];

function respond(body: unknown, status = 200): void {
  globalThis.fetch = (input) => {
    requests.push(String(input));
    return Promise.resolve(Response.json(body, { status }));
  };
}

afterEach(() => { globalThis.fetch = realFetch; requests = []; });

describe('DefiLlama current quotes', () => {
  test('fetches only requested identifiers from the free API without a key', async () => {
    respond({ coins: { [eth]: quote, [btc]: { ...quote, price: 80000 }, unrelated: quote } });
    expect(await getCurrentPrices([eth, btc, eth])).toEqual({
      [eth]: { usd: 4000, timestamp: now }, [btc]: { usd: 80000, timestamp: now },
    });
    expect(requests).toEqual(['https://coins.llama.fi/prices/current/ethereum%3A0x0000000000000000000000000000000000000000,bitcoin%3Abtc']);
  });

  test.each([0, -1, null, '4000', 'Infinity'])('rejects invalid price %p', async (price) => {
    respond({ coins: { [eth]: { ...quote, price }, [btc]: quote } });
    expect(await getCurrentPrices([eth, btc])).toEqual({ [btc]: { usd: 4000, timestamp: now } });
  });

  test.each([undefined, -1, 0.49, 1.1, '0.99'])('rejects invalid confidence %p', async (confidence) => {
    respond({ coins: { [eth]: { ...quote, confidence } } });
    expect(await getCurrentPrices([eth])).toEqual({});
  });

  test.each([undefined, 'now', now - 901, now + 120])('rejects missing, stale or future timestamp %p', async (timestamp) => {
    respond({ coins: { [eth]: { ...quote, timestamp } } });
    expect(await getCurrentPrices([eth])).toEqual({});
  });

  test('missing quotes stay unavailable', async () => {
    respond({ coins: {} });
    expect(await getCurrentPrices([eth, btc])).toEqual({});
  });

  test('a transport error rejects rather than reporting an empty success', async () => {
    respond({ coins: { [eth]: quote } }, 429);
    await expect(getCurrentPrices([eth])).rejects.toThrow('defillama 429');
  });

  test('malformed envelopes reject', async () => {
    respond({ error: 'upstream unavailable' });
    await expect(getCurrentPrices([eth])).rejects.toThrow('invalid payload');
  });

  test('empty requests do not fetch', async () => {
    respond({ coins: {} });
    expect(await getCurrentPrices([])).toEqual({});
    expect(await getPriceChanges([])).toEqual({});
    expect(requests).toEqual([]);
  });
});

describe('DefiLlama 24 hour changes', () => {
  test('preserves positive and negative changes without treating a missing coin as zero', async () => {
    respond({ coins: { [eth]: 2, [btc]: -3, bad: '4' } });
    expect(await getPriceChanges([eth, btc, 'missing', 'bad'])).toEqual({ [eth]: 2, [btc]: -3 });
    expect(requests[0]).toContain('/percentage/ethereum%3A0x0000000000000000000000000000000000000000,bitcoin%3Abtc');
  });
});
