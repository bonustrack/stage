import { describe, expect, test } from 'bun:test';
import { assertUploadSize, fromFirstUrl, MAX_UPLOAD_BYTES, resolveUploadResponse, swarmDownloadUrls, swarmToHttp, SWARM_GATEWAY } from '../lib/attachmentStorage';

const STORED_ID = 'Zm9vYmFyYmF6cXV4cXV1eGNvcmdlZ3Jh';
const STORED_URL = `https://proxy.stage.box/attachments/${STORED_ID}`;

describe('resolveUploadResponse', () => {
  test('builds the download link from the returned id and the proxy base', () => {
    expect(resolveUploadResponse(200, { id: STORED_ID }, 'a.pdf')).toBe(STORED_URL);
    expect(resolveUploadResponse(201, { id: STORED_ID }, 'a.pdf')).toBe(STORED_URL);
  });

  test('explains a file that is too large', () => {
    expect(() => resolveUploadResponse(413, null, 'big.mov')).toThrow(
      'Couldn\'t send "big.mov": the file is too large (413). Try a smaller file.',
    );
  });

  test('explains a rate limit', () => {
    expect(() => resolveUploadResponse(429, null, 'a.png')).toThrow(/too many uploads/);
  });

  test('reports other failures with the status', () => {
    expect(() => resolveUploadResponse(502, null, 'a.png')).toThrow(/upload failed \(502\)/);
  });

  test('rejects a 2xx answer without an id', () => {
    expect(() => resolveUploadResponse(200, {}, 'a.png')).toThrow(/returned no id/);
    expect(() => resolveUploadResponse(200, null, 'a.png')).toThrow(/returned no id/);
  });
});

describe('assertUploadSize', () => {
  test('refuses a file over 100 MB before any upload, with the size message', () => {
    expect(() => assertUploadSize(MAX_UPLOAD_BYTES, 'a.mov')).not.toThrow();
    expect(() => assertUploadSize(MAX_UPLOAD_BYTES + 1, 'a.mov')).toThrow(
      'Couldn\'t send "a.mov": the file is too large (over 100 MB). Try a smaller file.',
    );
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

  test('keeps a proxy link or any other url as the only source', () => {
    expect(swarmDownloadUrls(STORED_URL)).toEqual([STORED_URL]);
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
