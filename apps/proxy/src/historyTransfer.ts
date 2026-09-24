import { readCappedBytes } from './ssrf.ts';
import { corsHeaders, corsResponse } from './respond.ts';
import {
  HISTORY_ENVS, HISTORY_PREFIX, MAX_ARCHIVE_BYTES, hasChunks, putChunks, readChunks,
  type ArchiveNamespace, type ArchiveStorage,
} from './historyStore.ts';

export const TRANSFER_TTL_MS = 24 * 60 * 60 * 1000;
export const MAX_TRANSFER_DOWNLOADS = 3;
const TRANSFER_ID = /^[0-9a-f]{64}$/;
const DOWNLOADS_KEY = 'downloads';
const OBJECT_URL = 'https://history-transfer/';
const METHODS: ReadonlySet<string> = new Set(['PUT', 'GET', 'DELETE']);

const TRANSFER_CORS_HEADERS = corsHeaders('GET, PUT, DELETE, OPTIONS');

export interface TransferRoute { env: string; id: string }

export interface LookupLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface TransferDeps<Id> {
  ns: ArchiveNamespace<Id> | undefined;
  limiter: LookupLimiter | undefined;
  clientIp: string;
}

export function parseTransferRoute(pathname: string): TransferRoute | null {
  if (!pathname.startsWith(HISTORY_PREFIX)) return null;
  const [env, kind, id, ...rest] = pathname.slice(HISTORY_PREFIX.length).split('/');
  if (env === undefined || !HISTORY_ENVS.has(env) || kind !== 'transfer' || rest.length > 0) return null;
  if (id === undefined || !TRANSFER_ID.test(id)) return null;
  return { env, id };
}

export function isTransferPath(pathname: string): boolean {
  return pathname.startsWith(HISTORY_PREFIX) && pathname.split('/')[3] === 'transfer';
}

function text(body: string | null, status: number): Response {
  return corsResponse(TRANSFER_CORS_HEADERS, body, status, body === null ? null : 'text/plain');
}

async function upload(request: Request, forward: (init: RequestInit) => Promise<Response>): Promise<Response> {
  const body = await readCappedBytes(new Response(request.body), MAX_ARCHIVE_BYTES, 'reject');
  if (body === null) return text('archive too large', 413);
  if (body.byteLength === 0) return text('empty archive', 400);
  const stored = await forward({ method: 'PUT', body });
  if (stored.status === 409) return text('transfer already exists', 409);
  if (!stored.ok) return text('could not store transfer', 502);
  return corsResponse(TRANSFER_CORS_HEADERS, await stored.text(), 201, 'application/json');
}

async function lookup(method: string, forward: (init: RequestInit) => Promise<Response>): Promise<Response> {
  const stored = await forward({ method });
  if (method === 'DELETE') return text(null, 204);
  if (!stored.ok) return text('transfer not found', 404);
  return corsResponse(TRANSFER_CORS_HEADERS, stored.body, 200, 'application/octet-stream');
}

async function allowed(deps: TransferDeps<unknown>): Promise<boolean> {
  if (deps.limiter === undefined) return true;
  return (await deps.limiter.limit({ key: deps.clientIp })).success;
}

export async function handleTransfer<Id>(request: Request, deps: TransferDeps<Id>): Promise<Response> {
  if (request.method === 'OPTIONS') return text(null, 204);
  const route = parseTransferRoute(new URL(request.url).pathname);
  if (route === null || !METHODS.has(request.method)) return text('not found', 404);
  const { ns } = deps;
  if (ns === undefined) return text('transfer storage is not configured', 503);
  if (request.method !== 'PUT' && !(await allowed(deps))) return text('too many attempts', 429);
  const stub = ns.get(ns.idFromName(`${route.env}/${route.id}`));
  const forward = (init: RequestInit): Promise<Response> => stub.fetch(OBJECT_URL, init);
  return request.method === 'PUT' ? upload(request, forward) : lookup(request.method, forward);
}

async function storeTransfer(request: Request, storage: ArchiveStorage, now: number): Promise<Response> {
  if (await hasChunks(storage)) return new Response(null, { status: 409 });
  const expiresAt = now + TRANSFER_TTL_MS;
  await putChunks(storage, new Uint8Array(await request.arrayBuffer()));
  await storage.put({ [DOWNLOADS_KEY]: 0 });
  await storage.setAlarm(expiresAt);
  return new Response(JSON.stringify({ expiresAt }), { status: 201, headers: { 'content-type': 'application/json' } });
}

async function readTransfer(storage: ArchiveStorage): Promise<Response> {
  const bytes = await readChunks(storage);
  if (bytes === null) return new Response(null, { status: 404 });
  const previous = (await storage.get([DOWNLOADS_KEY])).get(DOWNLOADS_KEY);
  const downloads = (typeof previous === 'number' ? previous : 0) + 1;
  if (downloads >= MAX_TRANSFER_DOWNLOADS) await storage.deleteAll();
  else await storage.put({ [DOWNLOADS_KEY]: downloads });
  return new Response(bytes, { status: 200, headers: { 'content-type': 'application/octet-stream' } });
}

export async function transferObjectFetch(request: Request, storage: ArchiveStorage, now = Date.now()): Promise<Response> {
  if (request.method === 'PUT') return storeTransfer(request, storage, now);
  if (request.method === 'GET') return readTransfer(storage);
  if (request.method !== 'DELETE') return new Response(null, { status: 405 });
  await storage.deleteAll();
  return new Response(null, { status: 204 });
}

export class HistoryTransfers {
  private readonly storage: DurableObjectStorage;

  constructor(state: DurableObjectState) {
    this.storage = state.storage;
  }

  fetch(request: Request): Promise<Response> {
    return transferObjectFetch(request, this.storage);
  }

  alarm(): Promise<void> {
    return this.storage.deleteAll();
  }
}
