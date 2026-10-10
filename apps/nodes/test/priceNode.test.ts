import { afterEach, describe, expect, test } from 'bun:test';
import { handlePriceNode } from '../src/priceNode.ts';

const NODE = 'https://nodes.stage.box/eth-price';
const BTC_NODE = 'https://nodes.stage.box/btc-price';
const realFetch = globalThis.fetch;
const nowSeconds = Math.floor(Date.now() / 1000);

function stubPrices(price: number, change: number | null, calls: string[] = []): string[] {
  globalThis.fetch = Object.assign(async (input: RequestInfo | URL): Promise<Response> => {
    const url = String(input);
    calls.push(url);
    const coin = decodeURIComponent(url.slice(url.lastIndexOf('/') + 1));
    if (url.includes('/prices/current/')) {
      return Response.json({ coins: { [coin]: { price, timestamp: nowSeconds, confidence: 0.99 } } });
    }
    return Response.json({ coins: change === null ? {} : { [coin]: change } });
  }, { preconnect: realFetch.preconnect });
  return calls;
}

function memoryCache(): Cache {
  const entries = new Map<string, Response>();
  return {
    match: async (key: Request) => entries.get(key.url)?.clone(),
    put: async (key: Request, response: Response) => { entries.set(key.url, response.clone()); },
  } as unknown as Cache;
}

const children = (widget: { children?: { type: string; value?: string; label?: string; children?: unknown[] }[] }): string[] =>
  JSON.stringify(widget).match(/"(?:value|label)":"[^"]*"/g) ?? [];

afterEach(() => { globalThis.fetch = realFetch; });

describe('price nodes', () => {
  test('answers a load with a ChatKit card: price, 24h change and a Refresh button', async () => {
    stubPrices(2487.694, 0.336);
    const res = await handlePriceNode(new Request(NODE), undefined);
    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    expect(res.headers.get('cache-control')).toBe('no-store');
    const widget = await res.json() as Parameters<typeof children>[0];
    expect((widget as { type: string }).type).toBe('Card');
    expect(children(widget)).toEqual([
      '"value":"Ethereum"', '"label":"+0.34% 24h"', '"value":"$2,487.69"', expect.stringMatching(/^"value":"Updated \d\d:\d\d:\d\d UTC"$/), '"label":"Refresh"',
    ]);
  });

  test('a Refresh tap gets a ChatKit sync action response, other actions keep the widget', async () => {
    stubPrices(2400, -1.5);
    const refresh = { type: 'threads.sync_custom_action', params: { thread_id: 'k', item_id: 'k', action: { type: 'refresh' } } };
    const res = await handlePriceNode(new Request(NODE, { method: 'POST', body: JSON.stringify(refresh) }), undefined);
    const body = await res.json() as { updated_item: { type: string; widget: Parameters<typeof children>[0] } };
    expect(body.updated_item.type).toBe('widget');
    expect(children(body.updated_item.widget)).toContain('"label":"-1.50% 24h"');
    const other = await handlePriceNode(new Request(NODE, { method: 'POST', body: JSON.stringify({ params: { action: { type: 'buy' } } }) }), undefined);
    expect(await other.json()).toEqual({});
    expect(await (await handlePriceNode(new Request(NODE, { method: 'POST', body: 'nope' }), undefined)).json()).toEqual({});
  });

  test('answers CORS preflight for the signed Stage headers and refuses other methods', async () => {
    const pre = await handlePriceNode(new Request(NODE, { method: 'OPTIONS' }), undefined);
    expect(pre.status).toBe(204);
    expect(pre.headers.get('access-control-allow-headers')).toBe('content-type, stage-key, stage-timestamp, stage-signature');
    const refused = await handlePriceNode(new Request(NODE, { method: 'DELETE' }), undefined);
    expect(refused.status).toBe(405);
    expect(refused.headers.get('access-control-allow-origin')).toBe('*');
  });

  test('a load reuses a price up to 20 s old, a Refresh tap one up to 5 s old', async () => {
    const cache = memoryCache();
    const key = new Request('https://nodes.stage.box/eth-price?cached=widget');
    await cache.put(key, Response.json({ usd: 2000, change: 1, at: Date.now() - 10_000 }));
    const calls = stubPrices(2100, 2);
    const load = await (await handlePriceNode(new Request(NODE), cache)).json() as Parameters<typeof children>[0];
    expect(children(load)).toContain('"value":"$2,000.00"');
    expect(calls).toHaveLength(0);
    const tap = { type: 'threads.sync_custom_action', params: { action: { type: 'refresh' } } };
    const tapped = await (await handlePriceNode(new Request(NODE, { method: 'POST', body: JSON.stringify(tap) }), cache)).json() as { updated_item: { widget: Parameters<typeof children>[0] } };
    expect(children(tapped.updated_item.widget)).toContain('"value":"$2,100.00"');
    expect(calls).toHaveLength(2);
    globalThis.fetch = Object.assign(async (): Promise<Response> => new Response('down', { status: 503 }), { preconnect: realFetch.preconnect });
    await cache.put(key, Response.json({ usd: 2000, change: 1, at: Date.now() - 10_000 }));
    const stale = await (await handlePriceNode(new Request(NODE, { method: 'POST', body: JSON.stringify(tap) }), cache)).json() as { updated_item: { widget: Parameters<typeof children>[0] } };
    expect(children(stale.updated_item.widget)).toContain('"value":"$2,000.00"');
  });

  test('many loads share one cached price, and a failing source shows Unavailable without caching it', async () => {
    const cache = memoryCache();
    const calls = stubPrices(2500, null);
    await handlePriceNode(new Request(NODE), cache);
    const second = await (await handlePriceNode(new Request(`${NODE}?v=2`), cache)).json() as Parameters<typeof children>[0];
    expect(calls).toHaveLength(2);
    expect(children(second)).toContain('"value":"$2,500.00"');
    expect(children(second).some(text => text.includes('24h'))).toBe(false);
    globalThis.fetch = Object.assign(async (): Promise<Response> => new Response('down', { status: 503 }), { preconnect: realFetch.preconnect });
    const empty = memoryCache();
    const down = await (await handlePriceNode(new Request(NODE), empty)).json() as Parameters<typeof children>[0];
    expect(children(down)).toContain('"value":"Unavailable"');
    expect(await empty.match(new Request('https://nodes.stage.box/eth-price?cached=widget'))).toBeUndefined();
  });

  test('the btc node answers a Bitcoin card and a Refresh tap from its own coin and cache entry', async () => {
    const cache = memoryCache();
    stubPrices(2500, 1);
    await handlePriceNode(new Request(NODE), cache);
    const calls = stubPrices(82610.153, -0.4);
    const load = await (await handlePriceNode(new Request(BTC_NODE), cache)).json() as Parameters<typeof children>[0];
    expect(children(load)).toEqual([
      '"value":"Bitcoin"', '"label":"-0.40% 24h"', '"value":"$82,610.15"', expect.stringMatching(/^"value":"Updated \d\d:\d\d:\d\d UTC"$/), '"label":"Refresh"',
    ]);
    expect(calls.map(url => new URL(url).pathname)).toEqual(['/prices/current/coingecko%3Abitcoin', '/percentage/coingecko%3Abitcoin']);
    expect(await (await cache.match(new Request('https://nodes.stage.box/btc-price?cached=widget')))?.json()).toMatchObject({ usd: 82610.153 });
    const tap = { type: 'threads.sync_custom_action', params: { action: { type: 'refresh' } } };
    const tapped = await (await handlePriceNode(new Request(BTC_NODE, { method: 'POST', body: JSON.stringify(tap) }), cache)).json() as { updated_item: { widget: Parameters<typeof children>[0] } };
    expect(children(tapped.updated_item.widget).slice(0, 3)).toEqual(['"value":"Bitcoin"', '"label":"-0.40% 24h"', '"value":"$82,610.15"']);
  });

  test('other paths, the old proxy paths included, are not found', async () => {
    for (const path of ['/', '/doge-price', '/nodes/eth-price']) {
      const res = await handlePriceNode(new Request(`https://nodes.stage.box${path}`), undefined);
      expect(res.status).toBe(404);
      expect(res.headers.get('access-control-allow-origin')).toBe('*');
    }
  });
});
