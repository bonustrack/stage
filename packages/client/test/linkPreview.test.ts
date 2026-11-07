import { afterEach, describe, expect, test } from 'bun:test';
import { fetchLinkPreview, isX402 } from '../src/api/linkPreview';
import { fakeFetch } from './helpers';

const realFetch = globalThis.fetch;
const PAGE = 'https://example.com/post';
let headers: Headers | null = null;

function respond(body: unknown, status = 200): void {
  globalThis.fetch = fakeFetch((_input, init) => {
    headers = new Headers(init?.headers);
    return Promise.resolve(Response.json(body, { status }));
  });
}

afterEach(() => {
  globalThis.fetch = realFetch;
  headers = null;
});

describe('link preview replies', () => {
  test('keep the text fields, drop the rest and fall back to the asked url', async () => {
    respond({ title: 'Post', image: 'https://proxy.stage.box/img?url=x', siteName: 7, imageOrigin: 'https://example.com/a.png', extra: 1 });
    expect(await fetchLinkPreview('https://proxy.stage.box', PAGE)).toEqual({
      url: PAGE,
      title: 'Post',
      image: 'https://proxy.stage.box/img?url=x',
      imageOrigin: 'https://example.com/a.png',
    });
    expect(headers?.get('x-stage-client')).toBe('1');
  });

  test('are no preview without a title or an image, on an error or a failed status', async () => {
    respond({ url: PAGE, description: 'only words' });
    expect(await fetchLinkPreview('https://proxy.stage.box', PAGE)).toBeNull();
    respond({ error: 'no previewable content' });
    expect(await fetchLinkPreview('https://proxy.stage.box', PAGE)).toBeNull();
    respond({ title: 'Post' }, 422);
    expect(await fetchLinkPreview('https://proxy.stage.box', PAGE)).toBeNull();
    respond(['not', 'an', 'object']);
    expect(await fetchLinkPreview('https://proxy.stage.box', PAGE)).toBeNull();
  });

  test('carry an x402 challenge as a challenge', async () => {
    respond({ kind: 'x402', endpoint: PAGE, accepts: [{ scheme: 'exact', network: 'base', amount: '1000' }] });
    const result = await fetchLinkPreview('https://proxy.stage.box', PAGE);
    expect(isX402(result)).toBe(true);
  });
});
