import { afterEach, describe, expect, test } from 'bun:test';
import worker, { allowedTarget, outbound } from '../src/outbound.ts';

const realFetch = globalThis.fetch;

function stubFetch(): Request[] {
  const seen: Request[] = [];
  globalThis.fetch = Object.assign(async (input: RequestInfo | URL): Promise<Response> => {
    seen.push(input as Request);
    return new Response('ok');
  }, { preconnect: realFetch.preconnect });
  return seen;
}

afterEach(() => { globalThis.fetch = realFetch; });

describe('node outbound filter', () => {
  test('lets nodes call public https host names', () => {
    for (const url of ['https://api.coingecko.com/api/v3/ping', 'https://example.com', 'https://a.b.example.org/x?y=1', 'https://xn--bcher-kva.example/']) {
      expect([url, allowedTarget(url)]).toEqual([url, true]);
    }
  });

  test('blocks Stage hosts, local names, IP addresses, other schemes and ports', () => {
    const blocked = [
      'https://stage.box/', 'https://nodes.stage.box/0123456789abcdef0123456789abcdef', 'https://proxy.stage.box/nodes',
      'https://blob.stage.box/', 'https://STAGE.BOX./', 'http://example.com/', 'https://example.com:8443/', 'https://example.com:443x/',
      'https://1.1.1.1/', 'https://2130706433/', 'https://[2606:4700::1111]/', 'https://localhost/', 'https://printer.local/',
      'https://db.internal/', 'https://intranet/', 'https://user:pass@example.com/', 'ftp://example.com/', 'not a url',
    ];
    for (const url of blocked) expect([url, allowedTarget(url)]).toEqual([url, false]);
  });

  test('forwards an allowed call without following redirects', async () => {
    const seen = stubFetch();
    const res = await worker.fetch(new Request('https://example.com/data', { method: 'POST', body: 'x', headers: { 'x-a': '1' } }));
    expect(await res.text()).toBe('ok');
    expect(seen).toHaveLength(1);
    expect(seen[0]?.url).toBe('https://example.com/data');
    expect(seen[0]?.method).toBe('POST');
    expect(seen[0]?.redirect).toBe('manual');
    expect(seen[0]?.headers.get('x-a')).toBe('1');
  });

  test('answers 403 for a blocked call without any network request', async () => {
    const seen = stubFetch();
    const res = await outbound(new Request('https://proxy.stage.box/names/claim', { method: 'POST', body: '{}' }));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'nodes can only call public https hosts' });
    expect(seen).toEqual([]);
  });
});
