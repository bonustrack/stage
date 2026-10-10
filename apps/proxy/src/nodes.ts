import { NODE_CODE_MAX_BYTES, NODE_PUBLISH_PATH, hostedNodeUrl, nodeIdOf, nodeScriptName } from '@stage-labs/client/nodes/hosting';
import { base64urlBytes, isStrongNodeKey, nodeSigningText } from '@stage-labs/client/nodes/signing';
import { corsHeaders, corsResponse, jsonResponse } from './respond.ts';

export const NODES_PATH = NODE_PUBLISH_PATH;
export const NODES_NAMESPACE = 'stage-nodes';
export const MAX_NODES = 1000;
const MAIN_MODULE = 'node.js';
const COMPATIBILITY_DATE = '2026-06-01';
const COMPATIBILITY_FLAGS = ['global_fetch_strictly_public', 'disable_ctx_exports'];
const IMPORT = /\bimport\b/;
const CLOUDFLARE_API = 'https://api.cloudflare.com/client/v4';
const API_TIMEOUT_MS = 15_000;
const MAX_SKEW_SECONDS = 300;
const DETAIL_MAX_CHARS = 300;
const SIGNATURE_BYTES = 64;
const ACCOUNT_ID = /^[0-9a-f]{32}$/;
const TIMESTAMP = /^\d{1,12}$/;
const LONG_HEX = /[0-9a-f]{32,}/gi;
const CORS = corsHeaders('PUT, DELETE, OPTIONS', 'content-type, stage-key, stage-timestamp, stage-signature');

export interface ApiReply { status: number; result: unknown; message: string | null }

export type NodesApi = (method: 'GET' | 'PUT' | 'DELETE', path: string, body?: FormData) => Promise<ApiReply>;

export interface NodesDeps {
  api: NodesApi | null;
  limited: () => Promise<boolean>;
  now?: () => number;
}

const reply = (body: unknown, status = 200): Response => jsonResponse(body, status, CORS);
const fail = (status: number, error: string): Response => reply({ error }, status);

function firstError(json: unknown): string | null {
  const errors = (json as { errors?: unknown } | null)?.errors;
  const first: unknown = Array.isArray(errors) ? errors[0] : undefined;
  const message = (first as { message?: unknown } | undefined)?.message;
  return typeof message === 'string' ? message : null;
}

async function apiReply(response: Response): Promise<ApiReply> {
  const json: unknown = await response.json().catch(() => null);
  return { status: response.status, result: (json as { result?: unknown } | null)?.result ?? null, message: firstError(json) };
}

export function cloudflareApi(token: string | undefined, accountId: string | undefined, fetcher: typeof fetch = fetch): NodesApi | null {
  const secret = token?.trim() ?? '';
  const account = accountId?.trim().toLowerCase() ?? '';
  if (secret === '' || !ACCOUNT_ID.test(account)) return null;
  const base = `${CLOUDFLARE_API}/accounts/${account}/workers/dispatch/namespaces/${NODES_NAMESPACE}`;
  return async (method, path, body) => {
    try {
      const response = await fetcher(`${base}${path}`, {
        method, body, headers: { authorization: `Bearer ${secret}` }, signal: AbortSignal.timeout(API_TIMEOUT_MS),
      });
      return await apiReply(response);
    } catch {
      return { status: 0, result: null, message: null };
    }
  };
}

function declaredLength(request: Request): number | null {
  const raw = request.headers.get('content-length');
  const size = raw === null ? Number.NaN : Number(raw);
  return Number.isSafeInteger(size) && size >= 0 ? size : null;
}

async function readCode(request: Request): Promise<Uint8Array | Response> {
  const length = declaredLength(request);
  if (length === null) return fail(411, 'content length required');
  if (length > NODE_CODE_MAX_BYTES) return fail(413, 'code too large');
  if (length === 0) return fail(400, 'code required');
  const code = new Uint8Array(await request.arrayBuffer());
  return code.byteLength > NODE_CODE_MAX_BYTES ? fail(413, 'code too large') : code;
}

async function verified(publicKey: Uint8Array, signature: Uint8Array, text: string): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey('raw', new Uint8Array(publicKey), { name: 'Ed25519' }, false, ['verify']);
    return await crypto.subtle.verify({ name: 'Ed25519' }, key, new Uint8Array(signature), new TextEncoder().encode(text));
  } catch {
    return false;
  }
}

interface SignedParts { keyId: string; publicKey: Uint8Array; signature: Uint8Array; timestamp: string }

function fresh(timestamp: string, nowMs: number): boolean {
  return TIMESTAMP.test(timestamp) && Math.abs(Number(timestamp) - nowMs / 1000) <= MAX_SKEW_SECONDS;
}

function signedParts(request: Request, nowMs: number): SignedParts | null {
  const keyId = request.headers.get('stage-key') ?? '';
  const timestamp = request.headers.get('stage-timestamp') ?? '';
  const publicKey = base64urlBytes(keyId);
  const signature = base64urlBytes(request.headers.get('stage-signature') ?? '');
  if (publicKey === null || signature?.length !== SIGNATURE_BYTES || !fresh(timestamp, nowMs) || !isStrongNodeKey(publicKey)) return null;
  return { keyId, publicKey, signature, timestamp };
}

async function signerNodeId(request: Request, body: Uint8Array, nowMs: number): Promise<string | null> {
  const parts = signedParts(request, nowMs);
  if (parts === null) return null;
  const text = nodeSigningText(request.method, request.url, parts.timestamp, body);
  return (await verified(parts.publicKey, parts.signature, text)) ? nodeIdOf(parts.keyId) : null;
}

function refusal(message: string | null): string {
  if (message === null) return 'Cloudflare refused the code';
  return message.replace(LONG_HEX, '-').replace(/\s+/g, ' ').trim().slice(0, DETAIL_MAX_CHARS);
}

function apiFailure(answer: ApiReply): Response {
  return answer.status === 429 ? fail(429, 'busy, try again in a minute') : fail(502, 'node hosting failed');
}

function scriptCount(answer: ApiReply): number {
  const count = (answer.result as { script_count?: unknown } | null)?.script_count;
  return typeof count === 'number' ? count : 0;
}

async function roomFor(api: NodesApi, script: string): Promise<Response | null> {
  const namespace = await api('GET', '');
  if (namespace.status === 404) return fail(503, 'nodes are not set up');
  if (namespace.status !== 200) return apiFailure(namespace);
  if (scriptCount(namespace) < MAX_NODES) return null;
  const existing = await api('GET', `/scripts/${script}`);
  if (existing.status === 200) return null;
  return existing.status === 404 ? fail(507, 'Stage hosts no more nodes for now') : apiFailure(existing);
}

function uploadForm(code: Uint8Array): FormData {
  const form = new FormData();
  const metadata = { main_module: MAIN_MODULE, compatibility_date: COMPATIBILITY_DATE, compatibility_flags: COMPATIBILITY_FLAGS, bindings: [] };
  form.set('metadata', JSON.stringify(metadata));
  form.set(MAIN_MODULE, new File([code], MAIN_MODULE, { type: 'application/javascript+module' }));
  return form;
}

async function publish(api: NodesApi, id: string, code: Uint8Array): Promise<Response> {
  const script = nodeScriptName(id);
  const full = await roomFor(api, script);
  if (full !== null) return full;
  const uploaded = await api('PUT', `/scripts/${script}`, uploadForm(code));
  if (uploaded.status === 200) return reply({ id, url: hostedNodeUrl(id) });
  return uploaded.status === 400 ? fail(400, refusal(uploaded.message)) : apiFailure(uploaded);
}

async function unpublish(api: NodesApi, id: string): Promise<Response> {
  const removed = await api('DELETE', `/scripts/${nodeScriptName(id)}`);
  if (removed.status === 200) return reply({ id });
  return removed.status === 404 ? fail(404, 'no such node') : apiFailure(removed);
}

async function putNode(request: Request, api: NodesApi, nowMs: number): Promise<Response> {
  const code = await readCode(request);
  if (code instanceof Response) return code;
  if (IMPORT.test(new TextDecoder().decode(code))) return fail(400, 'nodes can not use import');
  const id = await signerNodeId(request, code, nowMs);
  return id === null ? fail(401, 'invalid signature') : publish(api, id, code);
}

async function deleteNode(request: Request, api: NodesApi, nowMs: number): Promise<Response> {
  const id = await signerNodeId(request, new Uint8Array(), nowMs);
  return id === null ? fail(401, 'invalid signature') : unpublish(api, id);
}

export async function handleNodes(request: Request, deps: NodesDeps): Promise<Response> {
  if (request.method === 'OPTIONS') return corsResponse(CORS, null, 204);
  if (request.method !== 'PUT' && request.method !== 'DELETE') return fail(405, 'method not allowed');
  const { api } = deps;
  if (api === null) return fail(503, 'nodes are not set up');
  if (await deps.limited()) return fail(429, 'rate limited');
  const nowMs = (deps.now ?? Date.now)();
  return request.method === 'PUT' ? putNode(request, api, nowMs) : deleteNode(request, api, nowMs);
}
