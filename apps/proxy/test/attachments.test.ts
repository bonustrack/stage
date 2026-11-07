import { describe, expect, test } from 'bun:test';
import { PROXY_ROUTES } from '@stage-labs/client/endpoints';
import { UPLOAD_MAX_BYTES } from '@stage-labs/client/uploads';
import { handleAttachments, newAttachmentId, parseAttachmentRoute, r2AttachmentStore, type AttachmentStore } from '../src/attachments.ts';
import { randomBytes } from './memoryArchive.ts';

const ORIGIN = 'https://proxy.stage.box';
const ATTACHMENTS_PATH = PROXY_ROUTES.attachments;
const ID = 'A'.repeat(32);
const FILE_URL = `${ORIGIN}${ATTACHMENTS_PATH}/${ID}`;

function memoryStore(): AttachmentStore & { objects: Map<string, Uint8Array> } {
  const objects = new Map<string, Uint8Array>();
  const meta = (id: string): { size: number; etag: string } | null => {
    const bytes = objects.get(id);
    return bytes === undefined ? null : { size: bytes.byteLength, etag: `"${id}"` };
  };
  return {
    objects,
    put: async (id, body) => {
      objects.set(id, new Uint8Array(await new Response(body).arrayBuffer()));
    },
    get: async (id) => {
      const bytes = objects.get(id);
      const found = meta(id);
      return bytes === undefined || found === null ? null : { ...found, body: new Blob([bytes]).stream() };
    },
    head: async (id) => meta(id),
  };
}

function upload(bytes: Uint8Array, length = bytes.byteLength): Request {
  return new Request(`${ORIGIN}${ATTACHMENTS_PATH}`, { method: 'POST', body: bytes, headers: { 'content-length': String(length) } });
}

describe('parseAttachmentRoute', () => {
  test('maps the upload and the download by id', () => {
    expect(parseAttachmentRoute(ATTACHMENTS_PATH, 'POST')).toEqual({ kind: 'upload' });
    expect(parseAttachmentRoute(`${ATTACHMENTS_PATH}/${ID}`, 'GET')).toEqual({ kind: 'file', id: ID });
    expect(parseAttachmentRoute(`${ATTACHMENTS_PATH}/${ID}`, 'HEAD')).toEqual({ kind: 'file', id: ID });
  });

  test('rejects other methods, malformed ids and extra segments', () => {
    expect(parseAttachmentRoute(ATTACHMENTS_PATH, 'GET')).toBeNull();
    expect(parseAttachmentRoute(`${ATTACHMENTS_PATH}/`, 'GET')).toBeNull();
    expect(parseAttachmentRoute(`${ATTACHMENTS_PATH}/${ID}`, 'POST')).toBeNull();
    expect(parseAttachmentRoute(`${ATTACHMENTS_PATH}/${ID}`, 'DELETE')).toBeNull();
    expect(parseAttachmentRoute(`${ATTACHMENTS_PATH}/${ID}/more`, 'GET')).toBeNull();
    expect(parseAttachmentRoute(`${ATTACHMENTS_PATH}/${'a'.repeat(31)}`, 'GET')).toBeNull();
    expect(parseAttachmentRoute(`${ATTACHMENTS_PATH}/${'a'.repeat(33)}`, 'GET')).toBeNull();
    expect(parseAttachmentRoute(`${ATTACHMENTS_PATH}/../${ID}`, 'GET')).toBeNull();
    expect(parseAttachmentRoute(`${ATTACHMENTS_PATH}/${'a'.repeat(30)}.x`, 'GET')).toBeNull();
    expect(parseAttachmentRoute('/attachment', 'GET')).toBeNull();
  });
});

describe('newAttachmentId', () => {
  test('is 32 url-safe characters from 24 random bytes and never repeats', () => {
    const ids = new Set(Array.from({ length: 2_000 }, newAttachmentId));
    expect(ids.size).toBe(2_000);
    for (const id of ids) expect(parseAttachmentRoute(`${ATTACHMENTS_PATH}/${id}`, 'GET')).toEqual({ kind: 'file', id });
  });
});

describe('r2AttachmentStore', () => {
  type Bucket = Parameters<typeof r2AttachmentStore>[0];

  test('keeps every attachment under attachments/ in the bucket', async () => {
    const calls: string[] = [];
    const object = { body: new Blob([new Uint8Array([1, 2, 3])]).stream(), size: 3, httpEtag: '"etag"' };
    const bucket = {
      put: (key: string) => {
        calls.push(`put ${key}`);
        return Promise.resolve(null);
      },
      head: (key: string) => {
        calls.push(`head ${key}`);
        return Promise.resolve(object);
      },
      get: (key: string) => {
        calls.push(`get ${key}`);
        return Promise.resolve(object);
      },
    } as unknown as Bucket;
    const store = r2AttachmentStore(bucket);
    await store.put(ID, new Blob([new Uint8Array([1, 2, 3])]).stream());
    expect(await store.head(ID)).toEqual({ size: 3, etag: '"etag"' });
    expect((await store.get(ID))?.size).toBe(3);
    expect(calls).toEqual([`put attachments/${ID}`, `head attachments/${ID}`, `get attachments/${ID}`]);
  });

  test('a missing object reads as null', async () => {
    const bucket = { get: () => Promise.resolve(null), head: () => Promise.resolve(null) } as unknown as Bucket;
    const store = r2AttachmentStore(bucket);
    expect(await store.get(ID)).toBeNull();
    expect(await store.head(ID)).toBeNull();
  });
});

describe('handleAttachments', () => {
  test('stores an upload under a fresh id and serves the same bytes back', async () => {
    const store = memoryStore();
    const bytes = randomBytes(2_500_000);
    const uploaded = await handleAttachments(upload(bytes), store);
    expect(uploaded.status).toBe(200);
    expect(uploaded.headers.get('access-control-allow-origin')).toBe('*');
    const { id } = (await uploaded.json()) as { id: string };
    const url = `${ORIGIN}${ATTACHMENTS_PATH}/${id}`;
    expect(parseAttachmentRoute(`${ATTACHMENTS_PATH}/${id}`, 'GET')).toEqual({ kind: 'file', id });
    expect(store.objects.get(id)).toEqual(bytes);

    const downloaded = await handleAttachments(new Request(url), store);
    expect(downloaded.status).toBe(200);
    expect(new Uint8Array(await downloaded.arrayBuffer())).toEqual(bytes);
    expect(downloaded.headers.get('content-type')).toBe('application/octet-stream');
    expect(downloaded.headers.get('content-length')).toBe(String(bytes.byteLength));
    expect(downloaded.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
    expect(downloaded.headers.get('etag')).toBe(`"${id}"`);
    expect(downloaded.headers.get('x-content-type-options')).toBe('nosniff');
    expect(downloaded.headers.get('access-control-allow-origin')).toBe('*');

    const head = await handleAttachments(new Request(url, { method: 'HEAD' }), store);
    expect(head.status).toBe(200);
    expect(head.headers.get('content-length')).toBe(String(bytes.byteLength));
    expect(head.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
    expect(await head.text()).toBe('');
  });

  test('refuses an upload without a declared length, an empty one and one over the cap', async () => {
    const store = memoryStore();
    const unsized = new Request(`${ORIGIN}${ATTACHMENTS_PATH}`, { method: 'POST', body: new Blob([randomBytes(8)]).stream() });
    unsized.headers.delete('content-length');
    expect((await handleAttachments(unsized, store)).status).toBe(411);
    expect((await handleAttachments(upload(new Uint8Array(0)), store)).status).toBe(400);
    expect((await handleAttachments(upload(randomBytes(8), UPLOAD_MAX_BYTES + 1), store)).status).toBe(413);
    expect(store.objects.size).toBe(0);
  });

  test('a missing id is a CORS-tagged 404 and other paths are 404', async () => {
    const store = memoryStore();
    const missing = await handleAttachments(new Request(FILE_URL), store);
    expect(missing.status).toBe(404);
    expect(missing.headers.get('access-control-allow-origin')).toBe('*');
    expect((await handleAttachments(new Request(FILE_URL, { method: 'HEAD' }), store)).status).toBe(404);
    expect((await handleAttachments(new Request(`${ORIGIN}${ATTACHMENTS_PATH}/nope`), store)).status).toBe(404);
  });

  test('reports a missing bucket as 503 and a failing one as 502', async () => {
    expect((await handleAttachments(upload(randomBytes(8)), undefined)).status).toBe(503);
    const down = (): Promise<never> => Promise.reject(new Error('r2 down'));
    const broken: AttachmentStore = { put: down, get: down, head: down };
    expect((await handleAttachments(upload(randomBytes(8)), broken)).status).toBe(502);
    expect((await handleAttachments(new Request(FILE_URL), broken)).status).toBe(502);
  });
});
