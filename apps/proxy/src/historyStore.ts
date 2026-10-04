import { corsHeaders, corsResponse } from './respond.ts';

export const HISTORY_PREFIX = '/xmtp-history/';

export const HISTORY_ENVS: ReadonlySet<string> = new Set(['production', 'dev']);
export const MAX_UPLOAD_BYTES = 100_000_000;
export const MAX_ARCHIVE_BYTES = 1_000_000_000;
const CHUNK_BYTES = 1_000_000;
export const ARCHIVE_TTL_MS = 3 * 24 * 60 * 60 * 1000;
const FILE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const COUNT_KEY = 'chunks';
const BYTES_KEY = 'bytes';
const SIZE_KEY = 'size';
const OBJECT_URL = 'https://history-archive/';

const HISTORY_CORS_HEADERS = corsHeaders('GET, POST, OPTIONS');

export type HistoryRoute =
  | { kind: 'upload'; env: string }
  | { kind: 'part'; env: string; id: string }
  | { kind: 'file'; env: string; id: string };

export interface ArchiveStub {
  fetch(input: string, init?: RequestInit): Promise<Response>;
}

export interface ArchiveNamespace<Id> {
  idFromName(name: string): Id;
  get(id: Id): ArchiveStub;
}

export interface ArchiveStorage {
  get(keys: string[]): Promise<Map<string, unknown>>;
  put(entries: Record<string, ArrayBuffer | number>): Promise<void>;
  setAlarm(scheduledTime: number): Promise<void>;
  deleteAll(): Promise<void>;
}

function routeIn(env: string, segments: string[], method: string): HistoryRoute | null {
  const [kind, id, ...rest] = segments;
  if (rest.length > 0) return null;
  if (kind === 'upload' && method === 'POST') {
    if (id === undefined) return { kind: 'upload', env };
    return FILE_ID.test(id) ? { kind: 'part', env, id } : null;
  }
  if (kind !== 'files' || id === undefined || !FILE_ID.test(id) || method !== 'GET') return null;
  return { kind: 'file', env, id };
}

export function parseHistoryRoute(pathname: string, method: string): HistoryRoute | null {
  if (!pathname.startsWith(HISTORY_PREFIX)) return null;
  const [env, ...segments] = pathname.slice(HISTORY_PREFIX.length).split('/');
  if (env === undefined || !HISTORY_ENVS.has(env)) return null;
  return routeIn(env, segments, method);
}

function text(body: string | null, status: number): Response {
  return corsResponse(HISTORY_CORS_HEADERS, body, status, body === null ? null : 'text/plain');
}

function stubFor<Id>(ns: ArchiveNamespace<Id>, env: string, id: string): ArchiveStub {
  return ns.get(ns.idFromName(`${env}/${id}`));
}

async function upload<Id>(
  request: Request, ns: ArchiveNamespace<Id>, route: Exclude<HistoryRoute, { kind: 'file' }>,
): Promise<Response> {
  const id = route.kind === 'part' ? route.id : crypto.randomUUID();
  const { search } = new URL(request.url);
  const stored = await stubFor(ns, route.env, id).fetch(`${OBJECT_URL}${route.kind}${search}`, { method: 'POST', body: request.body });
  if (stored.ok) return text(id, 200);
  return stored.status < 500 ? text(await stored.text(), stored.status) : text('could not store archive', 502);
}

async function download<Id>(ns: ArchiveNamespace<Id>, env: string, id: string): Promise<Response> {
  const stored = await stubFor(ns, env, id).fetch(OBJECT_URL, { method: 'GET' });
  if (!stored.ok) return text('archive not found', 404);
  return corsResponse(HISTORY_CORS_HEADERS, stored.body, 200, 'application/octet-stream');
}

export async function handleHistory<Id>(request: Request, ns: ArchiveNamespace<Id> | undefined): Promise<Response> {
  if (request.method === 'OPTIONS') return text(null, 204);
  const route = parseHistoryRoute(new URL(request.url).pathname, request.method);
  if (route === null) return text('not found', 404);
  if (ns === undefined) return text('history storage is not configured', 503);
  try {
    return await (route.kind === 'file' ? download(ns, route.env, route.id) : upload(request, ns, route));
  } catch {
    return text('history store error', 502);
  }
}

function chunkKey(index: number, prefix: string): string {
  return `${prefix}chunk:${index}`;
}

function chunkKeys(count: number, prefix: string): string[] {
  return Array.from({ length: count }, (_, index) => chunkKey(index, prefix));
}

export async function putChunks(storage: Pick<ArchiveStorage, 'put'>, bytes: Uint8Array, prefix = ''): Promise<void> {
  const entries: Record<string, ArrayBuffer | number> = {};
  let count = 0;
  for (let offset = 0; offset < bytes.byteLength; offset += CHUNK_BYTES) {
    entries[chunkKey(count, prefix)] = bytes.slice(offset, offset + CHUNK_BYTES).buffer;
    count += 1;
  }
  entries[`${prefix}${COUNT_KEY}`] = count;
  await storage.put(entries);
}

function joined(chunks: Map<string, unknown>, keys: string[]): Uint8Array | null {
  const parts: Uint8Array[] = [];
  for (const key of keys) {
    const part = chunks.get(key);
    if (!(part instanceof ArrayBuffer)) return null;
    parts.push(new Uint8Array(part));
  }
  const out = new Uint8Array(parts.reduce((total, part) => total + part.byteLength, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.byteLength;
  }
  return out;
}

async function chunkCount(storage: Pick<ArchiveStorage, 'get'>, prefix: string): Promise<number> {
  const countKey = `${prefix}${COUNT_KEY}`;
  const count = (await storage.get([countKey])).get(countKey);
  return typeof count === 'number' && count > 0 ? count : 0;
}

export async function readChunks(storage: Pick<ArchiveStorage, 'get'>, prefix = ''): Promise<Uint8Array | null> {
  const count = await chunkCount(storage, prefix);
  if (count < 1) return null;
  const keys = chunkKeys(count, prefix);
  return joined(await storage.get(keys), keys);
}

export async function storedChunkKeys(storage: Pick<ArchiveStorage, 'get'>, prefix: string): Promise<string[]> {
  return [`${prefix}${COUNT_KEY}`, ...chunkKeys(await chunkCount(storage, prefix), prefix)];
}

interface ArchiveState { count: number; bytes: number; size: number | null }

async function archiveState(storage: Pick<ArchiveStorage, 'get'>): Promise<ArchiveState> {
  const stored = await storage.get([COUNT_KEY, BYTES_KEY, SIZE_KEY]);
  const value = (key: string): number | null => {
    const found = stored.get(key);
    return typeof found === 'number' ? found : null;
  };
  return { count: value(COUNT_KEY) ?? 0, bytes: value(BYTES_KEY) ?? 0, size: value(SIZE_KEY) };
}

function isOpen(state: ArchiveState): boolean {
  return state.size !== null && state.bytes < state.size;
}

function plain(body: string, status: number): Response {
  return new Response(body, { status, headers: { 'content-type': 'text/plain' } });
}

async function writeChunks(
  storage: Pick<ArchiveStorage, 'put'>, body: ReadableStream<Uint8Array> | null, first: number, limit: number,
): Promise<{ count: number; bytes: number } | null> {
  const chunk = new Uint8Array(CHUNK_BYTES);
  let count = first;
  let bytes = 0;
  let filled = 0;
  const flush = async (): Promise<void> => {
    await storage.put({ [chunkKey(count, '')]: chunk.slice(0, filled).buffer });
    count += 1;
    filled = 0;
  };
  if (body === null) return { count, bytes };
  const reader = body.getReader();
  for (;;) {
    const next = await reader.read();
    if (next.done) break;
    bytes += next.value.byteLength;
    if (bytes > limit) {
      await reader.cancel();
      return null;
    }
    for (let at = 0; at < next.value.byteLength;) {
      const take = Math.min(CHUNK_BYTES - filled, next.value.byteLength - at);
      chunk.set(next.value.subarray(at, at + take), filled);
      filled += take;
      at += take;
      if (filled === CHUNK_BYTES) await flush();
    }
  }
  if (filled > 0) await flush();
  return { count, bytes };
}

function declaredSize(raw: string | null): number | null | Response {
  if (raw === null) return null;
  const size = Number(raw);
  if (!Number.isSafeInteger(size) || size < 1) return plain('invalid archive size', 400);
  return size > MAX_ARCHIVE_BYTES ? plain('archive too large', 413) : size;
}

async function appendTo(
  request: Request, storage: ArchiveStorage, state: ArchiveState, size: number | null,
): Promise<Response> {
  const room = size === null ? MAX_UPLOAD_BYTES : Math.min(MAX_UPLOAD_BYTES, size - state.bytes);
  const written = await writeChunks(storage, request.body, state.count, room);
  if (written === null) return plain('archive too large', 413);
  if (written.bytes === 0) return plain('empty archive', 400);
  const sized: Record<string, number> = size === null ? {} : { [SIZE_KEY]: size };
  await storage.put({ [COUNT_KEY]: written.count, [BYTES_KEY]: state.bytes + written.bytes, ...sized });
  return new Response(null, { status: 204 });
}

async function storeArchive(request: Request, storage: ArchiveStorage, now: number): Promise<Response> {
  const url = new URL(request.url);
  const state = await archiveState(storage);
  if (url.pathname === '/part') return isOpen(state) ? appendTo(request, storage, state, state.size) : plain('archive not found', 404);
  const size = declaredSize(url.searchParams.get('size'));
  if (size instanceof Response) return size;
  await storage.setAlarm(now + ARCHIVE_TTL_MS);
  const stored = await appendTo(request, storage, state, size).catch(async (error: unknown) => {
    await storage.deleteAll();
    throw error;
  });
  if (!stored.ok) await storage.deleteAll();
  return stored;
}

async function readArchive(storage: ArchiveStorage): Promise<Response> {
  const state = await archiveState(storage);
  if (state.count < 1 || isOpen(state)) return new Response(null, { status: 404 });
  let index = 0;
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const key = chunkKey(index, '');
      const part = (await storage.get([key])).get(key);
      if (!(part instanceof ArrayBuffer)) {
        controller.error(new Error('archive chunk missing'));
        return;
      }
      controller.enqueue(new Uint8Array(part));
      index += 1;
      if (index === state.count) controller.close();
    },
  });
  return new Response(body, { status: 200, headers: { 'content-type': 'application/octet-stream' } });
}

export function archiveObjectFetch(request: Request, storage: ArchiveStorage, now = Date.now()): Promise<Response> {
  if (request.method === 'POST') return storeArchive(request, storage, now);
  if (request.method === 'GET') return readArchive(storage);
  return Promise.resolve(new Response(null, { status: 405 }));
}

export class HistoryArchives {
  private readonly storage: DurableObjectStorage;

  constructor(state: DurableObjectState) {
    this.storage = state.storage;
  }

  fetch(request: Request): Promise<Response> {
    return archiveObjectFetch(request, this.storage);
  }

  alarm(): Promise<void> {
    return this.storage.deleteAll();
  }
}
