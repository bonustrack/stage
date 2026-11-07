import { HISTORY_ENVS, PROXY_ROUTES, UPLOAD_MAX_BYTES } from '@stage-labs/client/endpoints';
import {
  CHUNK_COUNT_KEY,
  chunkStream,
  objectNamed,
  writeChunks,
  type ChunkStorage,
  type ObjectNamespace,
  type ObjectStub,
} from './durableChunks.ts';
import { corsHeaders, corsResponse, guarded, repliesWith } from './respond.ts';

const HISTORY_PREFIX = PROXY_ROUTES.history;
const HISTORY_ENV_NAMES: ReadonlySet<string> = new Set(HISTORY_ENVS);
export const MAX_ARCHIVE_BYTES = 1_000_000_000;
export const ARCHIVE_TTL_MS = 3 * 24 * 60 * 60 * 1000;
const FILE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const BYTES_KEY = 'bytes';
const SIZE_KEY = 'size';
const OBJECT_URL = 'https://history-archive/';

export const HISTORY_CORS_HEADERS = corsHeaders('GET, POST, OPTIONS');
const { text } = repliesWith(HISTORY_CORS_HEADERS);

type HistoryRoute = { kind: 'upload'; env: string } | { kind: 'part'; env: string; id: string } | { kind: 'file'; env: string; id: string };

export interface ArchiveStorage extends ChunkStorage {
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
  if (env === undefined || !HISTORY_ENV_NAMES.has(env)) return null;
  return routeIn(env, segments, method);
}

function stubFor<Id>(ns: ObjectNamespace<Id>, env: string, id: string): ObjectStub {
  return objectNamed(ns, `${env}/${id}`);
}

async function upload<Id>(request: Request, ns: ObjectNamespace<Id>, route: Exclude<HistoryRoute, { kind: 'file' }>): Promise<Response> {
  const id = route.kind === 'part' ? route.id : crypto.randomUUID();
  const { search } = new URL(request.url);
  const stored = await stubFor(ns, route.env, id).fetch(`${OBJECT_URL}${route.kind}${search}`, { method: 'POST', body: request.body });
  if (stored.ok) return text(id, 200);
  return stored.status < 500 ? text(await stored.text(), stored.status) : text('could not store archive', 502);
}

async function download<Id>(ns: ObjectNamespace<Id>, env: string, id: string): Promise<Response> {
  const stored = await stubFor(ns, env, id).fetch(OBJECT_URL, { method: 'GET' });
  if (!stored.ok) return text('archive not found', 404);
  return corsResponse(HISTORY_CORS_HEADERS, stored.body, 200, 'application/octet-stream');
}

export async function handleHistory<Id>(request: Request, ns: ObjectNamespace<Id> | undefined): Promise<Response> {
  const route = parseHistoryRoute(new URL(request.url).pathname, request.method);
  if (route === null) return text('not found', 404);
  if (ns === undefined) return text('history storage is not configured', 503);
  return await guarded(
    () => (route.kind === 'file' ? download(ns, route.env, route.id) : upload(request, ns, route)),
    () => text('history store error', 502),
  );
}

interface ArchiveState {
  count: number;
  bytes: number;
  size: number | null;
}

async function archiveState(storage: Pick<ArchiveStorage, 'get'>): Promise<ArchiveState> {
  const stored = await storage.get([CHUNK_COUNT_KEY, BYTES_KEY, SIZE_KEY]);
  const value = (key: string): number | null => {
    const found = stored.get(key);
    return typeof found === 'number' ? found : null;
  };
  return { count: value(CHUNK_COUNT_KEY) ?? 0, bytes: value(BYTES_KEY) ?? 0, size: value(SIZE_KEY) };
}

function isOpen(state: ArchiveState): boolean {
  return state.size !== null && state.bytes < state.size;
}

function plain(body: string, status: number): Response {
  return new Response(body, { status, headers: { 'content-type': 'text/plain' } });
}

function declaredSize(raw: string | null): number | null | Response {
  if (raw === null) return null;
  const size = Number(raw);
  if (!Number.isSafeInteger(size) || size < 1) return plain('invalid archive size', 400);
  return size > MAX_ARCHIVE_BYTES ? plain('archive too large', 413) : size;
}

async function appendTo(request: Request, storage: ArchiveStorage, state: ArchiveState, size: number | null): Promise<Response> {
  const room = size === null ? UPLOAD_MAX_BYTES : Math.min(UPLOAD_MAX_BYTES, size - state.bytes);
  const written = await writeChunks(storage, request.body, state.count, room);
  if (written === null) return plain('archive too large', 413);
  if (written.bytes === 0) return plain('empty archive', 400);
  const sized: Record<string, number> = size === null ? {} : { [SIZE_KEY]: size };
  await storage.put({ [CHUNK_COUNT_KEY]: written.count, [BYTES_KEY]: state.bytes + written.bytes, ...sized });
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
  return new Response(chunkStream(storage, state.count), { status: 200, headers: { 'content-type': 'application/octet-stream' } });
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
