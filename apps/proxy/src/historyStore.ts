import { readCappedBytes } from './ssrf.ts';
import { corsHeaders, corsResponse } from './respond.ts';

export const HISTORY_PREFIX = '/xmtp-history/';

export const HISTORY_ENVS: ReadonlySet<string> = new Set(['production', 'dev']);
export const MAX_ARCHIVE_BYTES = 50_000_000;
const CHUNK_BYTES = 1_000_000;
export const ARCHIVE_TTL_MS = 3 * 24 * 60 * 60 * 1000;
const FILE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const COUNT_KEY = 'chunks';
const OBJECT_URL = 'https://history-archive/';

const HISTORY_CORS_HEADERS = corsHeaders('GET, POST, OPTIONS');

export type HistoryRoute =
  | { kind: 'upload'; env: string }
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
  if (kind === 'upload' && id === undefined && method === 'POST') return { kind: 'upload', env };
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

async function upload<Id>(request: Request, ns: ArchiveNamespace<Id>, env: string): Promise<Response> {
  const body = await readCappedBytes(new Response(request.body), MAX_ARCHIVE_BYTES, 'reject');
  if (body === null) return text('archive too large', 413);
  if (body.byteLength === 0) return text('empty archive', 400);
  const id = crypto.randomUUID();
  const stored = await stubFor(ns, env, id).fetch(OBJECT_URL, { method: 'POST', body });
  if (!stored.ok) return text('could not store archive', 502);
  return text(id, 200);
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
  return route.kind === 'upload' ? upload(request, ns, route.env) : download(ns, route.env, route.id);
}

function chunkKey(index: number): string {
  return `chunk:${index}`;
}

function chunkKeys(count: number): string[] {
  return Array.from({ length: count }, (_, index) => chunkKey(index));
}

export async function putChunks(storage: ArchiveStorage, bytes: Uint8Array): Promise<void> {
  const entries: Record<string, ArrayBuffer | number> = {};
  let count = 0;
  for (let offset = 0; offset < bytes.byteLength; offset += CHUNK_BYTES) {
    entries[chunkKey(count)] = bytes.slice(offset, offset + CHUNK_BYTES).buffer;
    count += 1;
  }
  entries[COUNT_KEY] = count;
  await storage.put(entries);
}

async function storeArchive(request: Request, storage: ArchiveStorage, now: number): Promise<Response> {
  await putChunks(storage, new Uint8Array(await request.arrayBuffer()));
  await storage.setAlarm(now + ARCHIVE_TTL_MS);
  return new Response(null, { status: 204 });
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

export async function hasChunks(storage: ArchiveStorage): Promise<boolean> {
  const count = (await storage.get([COUNT_KEY])).get(COUNT_KEY);
  return typeof count === 'number' && count > 0;
}

export async function readChunks(storage: ArchiveStorage): Promise<Uint8Array | null> {
  const count = (await storage.get([COUNT_KEY])).get(COUNT_KEY);
  if (typeof count !== 'number' || count < 1) return null;
  const keys = chunkKeys(count);
  return joined(await storage.get(keys), keys);
}

async function readArchive(storage: ArchiveStorage): Promise<Response> {
  const bytes = await readChunks(storage);
  if (bytes === null) return new Response(null, { status: 404 });
  return new Response(bytes, { status: 200, headers: { 'content-type': 'application/octet-stream' } });
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
