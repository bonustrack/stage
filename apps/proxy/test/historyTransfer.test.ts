import { describe, expect, test } from 'bun:test';
import type { ArchiveNamespace, ArchiveStorage } from '../src/historyStore.ts';
import {
  MAX_TRANSFER_DOWNLOADS, TRANSFER_TTL_MS, handleTransfer, isTransferPath, parseTransferRoute, transferObjectFetch,
  type LookupLimiter,
} from '../src/historyTransfer.ts';

const ID = 'a'.repeat(64);
const OTHER_ID = 'b'.repeat(64);
const BASE = 'https://proxy.stage.box/xmtp-history';
const NOW = 5_000;

type MemoryStorage = ArchiveStorage & { alarm: number | null; data: Map<string, unknown> };

function memoryStorage(): MemoryStorage {
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

function memoryNamespace(): ArchiveNamespace<string> & { objects: Map<string, MemoryStorage> } {
  const objects = new Map<string, MemoryStorage>();
  return {
    objects,
    idFromName: (name) => name,
    get: (id) => ({
      fetch: (input, init) => {
        const storage = objects.get(id) ?? memoryStorage();
        objects.set(id, storage);
        return transferObjectFetch(new Request(input, init), storage, NOW);
      },
    }),
  };
}

function countingLimiter(max: number): LookupLimiter & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    limit: ({ key }) => {
      calls.push(key);
      return Promise.resolve({ success: calls.filter((k) => k === key).length <= max });
    },
  };
}

function deps(ns = memoryNamespace(), limiter: LookupLimiter | undefined = countingLimiter(100), clientIp = '1.2.3.4') {
  return { ns, limiter, clientIp };
}

const put = (id: string, body: Uint8Array, env = 'production'): Request =>
  new Request(`${BASE}/${env}/transfer/${id}`, { method: 'PUT', body });
const get = (id: string, env = 'production'): Request => new Request(`${BASE}/${env}/transfer/${id}`);
const del = (id: string): Request => new Request(`${BASE}/production/transfer/${id}`, { method: 'DELETE' });

describe('parseTransferRoute', () => {
  test('accepts a 64 hex id per environment', () => {
    expect(parseTransferRoute(`/xmtp-history/production/transfer/${ID}`)).toEqual({ env: 'production', id: ID });
    expect(parseTransferRoute(`/xmtp-history/dev/transfer/${ID}`)).toEqual({ env: 'dev', id: ID });
    expect(isTransferPath(`/xmtp-history/dev/transfer/${ID}`)).toBe(true);
    expect(isTransferPath('/xmtp-history/dev/upload')).toBe(false);
  });

  test('rejects bad ids, environments and extra segments', () => {
    expect(parseTransferRoute(`/xmtp-history/staging/transfer/${ID}`)).toBeNull();
    expect(parseTransferRoute(`/xmtp-history/production/transfer/${ID.toUpperCase()}`)).toBeNull();
    expect(parseTransferRoute('/xmtp-history/production/transfer/abc')).toBeNull();
    expect(parseTransferRoute(`/xmtp-history/production/transfer/${ID}/x`)).toBeNull();
    expect(parseTransferRoute(`/xmtp-history/production/files/${ID}`)).toBeNull();
  });
});

describe('handleTransfer', () => {
  test('answers preflight with CORS for PUT and DELETE', async () => {
    const res = await handleTransfer(new Request(`${BASE}/production/transfer/${ID}`, { method: 'OPTIONS' }), deps());
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    expect(res.headers.get('access-control-allow-methods')).toContain('PUT');
    expect(res.headers.get('access-control-allow-methods')).toContain('DELETE');
  });

  test('stores once, returns the expiry and serves the same bytes', async () => {
    const d = deps();
    const archive = crypto.getRandomValues(new Uint8Array(4_096));
    const stored = await handleTransfer(put(ID, archive), d);
    expect(stored.status).toBe(201);
    expect(await stored.json()).toEqual({ expiresAt: NOW + TRANSFER_TTL_MS });
    expect(d.ns.objects.get(`production/${ID}`)?.alarm).toBe(NOW + TRANSFER_TTL_MS);
    const again = await handleTransfer(put(ID, archive), d);
    expect(again.status).toBe(409);
    const downloaded = await handleTransfer(get(ID), d);
    expect(downloaded.status).toBe(200);
    expect(downloaded.headers.get('access-control-allow-origin')).toBe('*');
    expect(new Uint8Array(await downloaded.arrayBuffer())).toEqual(archive);
  });

  test('deletes on DELETE so a code works only once', async () => {
    const d = deps();
    await handleTransfer(put(ID, new Uint8Array([1, 2, 3])), d);
    expect((await handleTransfer(del(ID), d)).status).toBe(204);
    expect((await handleTransfer(get(ID), d)).status).toBe(404);
  });

  test('deletes after the maximum number of downloads', async () => {
    const d = deps();
    await handleTransfer(put(ID, new Uint8Array([9])), d);
    for (let i = 0; i < MAX_TRANSFER_DOWNLOADS; i += 1) expect((await handleTransfer(get(ID), d)).status).toBe(200);
    expect((await handleTransfer(get(ID), d)).status).toBe(404);
  });

  test('keeps ids and environments apart and 404s expired transfers', async () => {
    const d = deps();
    await handleTransfer(put(ID, new Uint8Array([7]), 'dev'), d);
    expect((await handleTransfer(get(ID), d)).status).toBe(404);
    expect((await handleTransfer(get(OTHER_ID, 'dev'), d)).status).toBe(404);
    await d.ns.objects.get(`dev/${ID}`)?.deleteAll();
    expect((await handleTransfer(get(ID, 'dev'), d)).status).toBe(404);
  });

  test('rate limits lookups per client ip', async () => {
    const limiter = countingLimiter(2);
    const d = deps(memoryNamespace(), limiter, '9.9.9.9');
    expect((await handleTransfer(get(ID), d)).status).toBe(404);
    expect((await handleTransfer(get(ID), d)).status).toBe(404);
    const blocked = await handleTransfer(get(ID), d);
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('access-control-allow-origin')).toBe('*');
    expect(limiter.calls).toEqual(['9.9.9.9', '9.9.9.9', '9.9.9.9']);
    expect((await handleTransfer(get(ID), { ...d, clientIp: '8.8.8.8' })).status).toBe(404);
  });

  test('rejects empty uploads, other methods and missing storage', async () => {
    expect((await handleTransfer(put(ID, new Uint8Array(0)), deps())).status).toBe(400);
    expect((await handleTransfer(new Request(`${BASE}/production/transfer/${ID}`, { method: 'POST', body: 'x' }), deps())).status).toBe(404);
    expect((await handleTransfer(get(ID), { ns: undefined, limiter: undefined, clientIp: 'x' })).status).toBe(503);
  });
});
