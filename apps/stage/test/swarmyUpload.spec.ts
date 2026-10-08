import { describe, expect, test } from 'bun:test';
import { fromFirstUrl, resolveSwarmyResponse, swarmDownloadUrls, swarmToHttp, SWARM_GATEWAY } from '../lib/swarmy';

describe('resolveSwarmyResponse', () => {
  test('returns the gateway url with trailing slash on success', () => {
    const ref = 'aa902c7392044a6492c5664b05364db15e7ae7bbc75fd505cd8b1a20f7389845';
    expect(resolveSwarmyResponse(200, { swarmReference: ref }, 'a.png')).toBe(`${SWARM_GATEWAY}${ref}/`);
    expect(resolveSwarmyResponse(201, { swarmReference: ref }, 'a.png')).toBe(`${SWARM_GATEWAY}${ref}/`);
  });

  test('reports a server size rejection without inventing a size limit', () => {
    expect(() => resolveSwarmyResponse(413, null, 'big.mov')).toThrow(
      'Couldn\'t send "big.mov": the upload service rejected the file size (413). Try a smaller file.',
    );
  });

  test('maps auth failures to a rejected message', () => {
    expect(() => resolveSwarmyResponse(401, null, 'a.png')).toThrow(/rejected the request/);
    expect(() => resolveSwarmyResponse(403, null, 'a.png')).toThrow(/rejected the request/);
  });

  test('maps other non-2xx to a failure message carrying the status', () => {
    expect(() => resolveSwarmyResponse(502, null, 'a.png')).toThrow(/upload failed \(502\)/);
  });

  test('throws when a 2xx response carries no reference', () => {
    expect(() => resolveSwarmyResponse(200, {}, 'a.png')).toThrow(/returned no reference/);
    expect(() => resolveSwarmyResponse(200, null, 'a.png')).toThrow(/returned no reference/);
  });

  test('never mentions the dead blob.stage.box proxy host', () => {
    let msg = '';
    try { resolveSwarmyResponse(500, null, 'a.png'); } catch (e) { msg = String(e); }
    expect(msg).not.toContain('blob.stage.box');
  });
});

describe('swarmToHttp', () => {
  test('rewrites a swarm:// ref to the swarmy bzz gateway', () => {
    expect(swarmToHttp('swarm://abc123')).toBe(`${SWARM_GATEWAY}abc123/`);
    expect(swarmToHttp('swarm://abc123///')).toBe(`${SWARM_GATEWAY}abc123/`);
  });

  test('passes through non-swarm urls unchanged', () => {
    expect(swarmToHttp('https://example.com/x.png')).toBe('https://example.com/x.png');
  });
});

describe('swarmDownloadUrls', () => {
  const ref = 'ab'.repeat(32);
  const fallback = `https://download.gateway.ethswarm.org/bzz/${ref}/`;

  test('adds the public Swarm gateway after Swarmy for a Swarm reference', () => {
    expect(swarmDownloadUrls(`${SWARM_GATEWAY}${ref}/`)).toEqual([`${SWARM_GATEWAY}${ref}/`, fallback]);
    expect(swarmDownloadUrls(`swarm://${ref}`)).toEqual([`${SWARM_GATEWAY}${ref}/`, fallback]);
  });

  test('keeps any other url as the only source', () => {
    expect(swarmDownloadUrls('https://example.com/x.png')).toEqual(['https://example.com/x.png']);
    expect(swarmDownloadUrls('swarm://abc123')).toEqual([`${SWARM_GATEWAY}abc123/`]);
  });
});

describe('fromFirstUrl', () => {
  test('falls back to the next url when the first fails', async () => {
    const tried: string[] = [];
    const result = await fromFirstUrl(['a', 'b'], (url) => {
      tried.push(url);
      return url === 'a' ? Promise.reject(new Error('500')) : Promise.resolve(`from ${url}`);
    });
    expect(result).toBe('from b');
    expect(tried).toEqual(['a', 'b']);
  });

  test('stops at the first url that works', async () => {
    const tried: string[] = [];
    await fromFirstUrl(['a', 'b'], (url) => {
      tried.push(url);
      return Promise.resolve(url);
    });
    expect(tried).toEqual(['a']);
  });

  test('throws the last error when every url fails', async () => {
    await expect(fromFirstUrl(['a', 'b'], (url) => Promise.reject(new Error(`down ${url}`)))).rejects.toThrow('down b');
  });
});
