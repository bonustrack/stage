import { describe, expect, test } from 'bun:test';
import {
  ARCHIVE_TTL_MS, archiveObjectFetch, handleHistory, parseHistoryRoute,
  type ArchiveNamespace, type ArchiveStorage,
} from '../src/historyStore.ts';

const FILE_ID = '9ef6fdd0-0635-4130-8b77-aaeae0f65158';

function memoryStorage(): ArchiveStorage & { alarm: number | null; data: Map<string, unknown> } {
  const data = new Map<string, unknown>();
  return {
    data,
    alarm: null,
    get: (keys) => Promise.resolve(new Map(keys.filter((key) => data.has(key)).map((key) => [key, data.get(key)]))),
    put(entries) {
      for (const [key, value] of Object.entries(entries)) data.set(key, value);
      return Promise.resolve();
    },
    setAlarm(time) {
      this.alarm = time;
      return Promise.resolve();
    },
    deleteAll() {
      data.clear();
      return Promise.resolve();
    },
  };
}

function memoryNamespace(): ArchiveNamespace<string> & { objects: Map<string, ReturnType<typeof memoryStorage>> } {
  const objects = new Map<string, ReturnType<typeof memoryStorage>>();
  return {
    objects,
    idFromName: (name) => name,
    get: (id) => ({
      fetch: (input, init) => {
        const storage = objects.get(id) ?? memoryStorage();
        objects.set(id, storage);
        return archiveObjectFetch(new Request(input, init), storage, 1_000);
      },
    }),
  };
}

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
    expect(parseHistoryRoute(`/xmtp-history/dev/files/${FILE_ID}`, 'GET')).toEqual({ kind: 'file', env: 'dev', id: FILE_ID });
  });

  test('rejects unknown environments, methods, ids and extra segments', () => {
    expect(parseHistoryRoute('/xmtp-history/staging/upload', 'POST')).toBeNull();
    expect(parseHistoryRoute('/xmtp-history/production/upload', 'GET')).toBeNull();
    expect(parseHistoryRoute('/xmtp-history/production/files/../etc', 'GET')).toBeNull();
    expect(parseHistoryRoute(`/xmtp-history/production/files/${FILE_ID}/b`, 'GET')).toBeNull();
    expect(parseHistoryRoute('/xmtp-history/production/files/abc-123', 'GET')).toBeNull();
    expect(parseHistoryRoute('/xmtp-history/production/files', 'GET')).toBeNull();
    expect(parseHistoryRoute('/other', 'GET')).toBeNull();
  });
});

describe('handleHistory', () => {
  test('answers preflight with permissive CORS headers', async () => {
    const res = await handleHistory(new Request('https://proxy.stage.box/xmtp-history/production/upload', { method: 'OPTIONS' }), memoryNamespace());
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    expect(res.headers.get('access-control-allow-methods')).toContain('POST');
  });

  test('returns a CORS-tagged 404 for paths outside the route table', async () => {
    const res = await handleHistory(new Request('https://proxy.stage.box/xmtp-history/production/nope', { method: 'GET' }), memoryNamespace());
    expect(res.status).toBe(404);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });

  test('stores an upload and serves the same bytes back by id', async () => {
    const ns = memoryNamespace();
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
    const ns = memoryNamespace();
    const uploaded = await handleHistory(new Request('https://proxy.stage.box/xmtp-history/dev/upload', { method: 'POST', body: randomBytes(10) }), ns);
    const id = await uploaded.text();
    const otherEnv = await handleHistory(new Request(`https://proxy.stage.box/xmtp-history/production/files/${id}`), ns);
    expect(otherEnv.status).toBe(404);
    await ns.objects.get(`dev/${id}`)?.deleteAll();
    const expired = await handleHistory(new Request(`https://proxy.stage.box/xmtp-history/dev/files/${id}`), ns);
    expect(expired.status).toBe(404);
  });

  test('rejects empty uploads and answers 503 without storage', async () => {
    const empty = await handleHistory(new Request('https://proxy.stage.box/xmtp-history/production/upload', { method: 'POST', body: new Uint8Array(0) }), memoryNamespace());
    expect(empty.status).toBe(400);
    const missing = await handleHistory(new Request(`https://proxy.stage.box/xmtp-history/production/files/${FILE_ID}`), undefined);
    expect(missing.status).toBe(503);
  });
});
