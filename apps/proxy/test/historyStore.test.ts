import { describe, expect, test } from 'bun:test';
import { ARCHIVE_TTL_MS, MAX_ARCHIVE_BYTES, archiveObjectFetch, handleHistory, parseHistoryRoute } from '../src/historyStore.ts';
import { memoryNamespace } from './memoryArchive.ts';

const FILE_ID = '9ef6fdd0-0635-4130-8b77-aaeae0f65158';

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  for (let offset = 0; offset < length; offset += 65_536) {
    crypto.getRandomValues(bytes.subarray(offset, Math.min(length, offset + 65_536)));
  }
  return bytes;
}

describe('parseHistoryRoute', () => {
  test('maps uploads and file downloads per environment', () => {
    expect(parseHistoryRoute('/xmtp-history/production/upload', 'POST')).toEqual({ kind: 'upload', env: 'production' });
    expect(parseHistoryRoute(`/xmtp-history/production/upload/${FILE_ID}`, 'POST')).toEqual({ kind: 'part', env: 'production', id: FILE_ID });
    expect(parseHistoryRoute(`/xmtp-history/dev/files/${FILE_ID}`, 'GET')).toEqual({ kind: 'file', env: 'dev', id: FILE_ID });
  });

  test('rejects unknown environments, methods, ids and extra segments', () => {
    expect(parseHistoryRoute('/xmtp-history/staging/upload', 'POST')).toBeNull();
    expect(parseHistoryRoute('/xmtp-history/production/upload', 'GET')).toBeNull();
    expect(parseHistoryRoute('/xmtp-history/production/upload/abc-123', 'POST')).toBeNull();
    expect(parseHistoryRoute(`/xmtp-history/production/upload/${FILE_ID}`, 'GET')).toBeNull();
    expect(parseHistoryRoute('/xmtp-history/production/files/../etc', 'GET')).toBeNull();
    expect(parseHistoryRoute(`/xmtp-history/production/files/${FILE_ID}/b`, 'GET')).toBeNull();
    expect(parseHistoryRoute('/xmtp-history/production/files/abc-123', 'GET')).toBeNull();
    expect(parseHistoryRoute('/xmtp-history/production/files', 'GET')).toBeNull();
    expect(parseHistoryRoute('/other', 'GET')).toBeNull();
    for (const method of ['GET', 'PUT', 'DELETE']) expect(parseHistoryRoute(`/xmtp-history/production/transfer/${'a'.repeat(64)}`, method)).toBeNull();
  });
});

describe('handleHistory', () => {
  test('answers preflight with permissive CORS headers', async () => {
    const res = await handleHistory(new Request('https://proxy.stage.box/xmtp-history/production/upload', { method: 'OPTIONS' }), memoryNamespace(archiveObjectFetch, 1_000));
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    expect(res.headers.get('access-control-allow-methods')).toContain('POST');
  });

  test('returns a CORS-tagged 404 for paths outside the route table', async () => {
    const res = await handleHistory(new Request('https://proxy.stage.box/xmtp-history/production/nope', { method: 'GET' }), memoryNamespace(archiveObjectFetch, 1_000));
    expect(res.status).toBe(404);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });

  test('stores an upload and serves the same bytes back by id', async () => {
    const ns = memoryNamespace(archiveObjectFetch, 1_000);
    const archive = randomBytes(2_500_000);
    const uploaded = await handleHistory(new Request('https://proxy.stage.box/xmtp-history/production/upload', { method: 'POST', body: archive }), ns);
    expect(uploaded.status).toBe(200);
    const id = await uploaded.text();
    expect(parseHistoryRoute(`/xmtp-history/production/files/${id}`, 'GET')).not.toBeNull();
    const stored = ns.objects.get(`production/${id}`);
    expect(stored?.data.get('chunks')).toBe(3);
    expect(stored?.alarm).toBe(1_000 + ARCHIVE_TTL_MS);
    const downloaded = await handleHistory(new Request(`https://proxy.stage.box/xmtp-history/production/files/${id}`), ns);
    expect(downloaded.status).toBe(200);
    expect(downloaded.headers.get('access-control-allow-origin')).toBe('*');
    expect(new Uint8Array(await downloaded.arrayBuffer())).toEqual(archive);
  });

  test('keeps environments apart and 404s unknown or expired archives', async () => {
    const ns = memoryNamespace(archiveObjectFetch, 1_000);
    const uploaded = await handleHistory(new Request('https://proxy.stage.box/xmtp-history/dev/upload', { method: 'POST', body: randomBytes(10) }), ns);
    const id = await uploaded.text();
    const otherEnv = await handleHistory(new Request(`https://proxy.stage.box/xmtp-history/production/files/${id}`), ns);
    expect(otherEnv.status).toBe(404);
    await ns.objects.get(`dev/${id}`)?.deleteAll();
    const expired = await handleHistory(new Request(`https://proxy.stage.box/xmtp-history/dev/files/${id}`), ns);
    expect(expired.status).toBe(404);
  });

  test('rejects empty uploads and answers 503 without storage', async () => {
    const empty = await handleHistory(new Request('https://proxy.stage.box/xmtp-history/production/upload', { method: 'POST', body: new Uint8Array(0) }), memoryNamespace(archiveObjectFetch, 1_000));
    expect(empty.status).toBe(400);
    const missing = await handleHistory(new Request(`https://proxy.stage.box/xmtp-history/production/files/${FILE_ID}`), undefined);
    expect(missing.status).toBe(503);
  });

  test('builds one archive from parts and serves it only once complete', async () => {
    const ns = memoryNamespace(archiveObjectFetch, 1_000);
    const archive = randomBytes(2_600_000);
    const post = (path: string, from: number, to: number): Promise<Response> => handleHistory(new Request(`https://proxy.stage.box/xmtp-history/production/${path}`, { method: 'POST', body: archive.slice(from, to) }), ns);
    const first = await post(`upload?size=${archive.byteLength}`, 0, 1_000_500);
    expect(first.status).toBe(200);
    const id = await first.text();
    const file = (): Promise<Response> => handleHistory(new Request(`https://proxy.stage.box/xmtp-history/production/files/${id}`), ns);
    expect((await file()).status).toBe(404);
    expect(await (await post(`upload/${id}`, 1_000_500, 2_000_000)).text()).toBe(id);
    expect((await post(`upload/${id}`, 2_000_000, archive.byteLength)).status).toBe(200);
    expect(ns.objects.get(`production/${id}`)?.alarm).toBe(1_000 + ARCHIVE_TTL_MS);
    const downloaded = await file();
    expect(downloaded.status).toBe(200);
    expect(new Uint8Array(await downloaded.arrayBuffer())).toEqual(archive);
    expect((await post(`upload/${id}`, 0, 10)).status).toBe(404);
  });

  test('refuses sizes over the cap, parts past the declared size and unknown archives', async () => {
    const ns = memoryNamespace(archiveObjectFetch, 1_000);
    const post = (path: string, body: Uint8Array): Promise<Response> => handleHistory(new Request(`https://proxy.stage.box/xmtp-history/dev/${path}`, { method: 'POST', body }), ns);
    expect((await post(`upload?size=${MAX_ARCHIVE_BYTES + 1}`, randomBytes(10))).status).toBe(413);
    expect((await post('upload?size=abc', randomBytes(10))).status).toBe(400);
    expect([...ns.objects.values()].every((object) => object.data.size === 0)).toBe(true);
    const id = await (await post('upload?size=20', randomBytes(10))).text();
    const over = await post(`upload/${id}`, randomBytes(11));
    expect(over.status).toBe(413);
    expect(over.headers.get('access-control-allow-origin')).toBe('*');
    expect((await post(`upload/${FILE_ID}`, randomBytes(10))).status).toBe(404);
  });

  test('answers a storage failure with a CORS-tagged 502', async () => {
    const broken = { idFromName: (name: string) => name, get: () => ({ fetch: () => Promise.reject(new Error('storage down')) }) };
    const res = await handleHistory(new Request('https://proxy.stage.box/xmtp-history/production/upload', { method: 'POST', body: randomBytes(10) }), broken);
    expect(res.status).toBe(502);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });
});
