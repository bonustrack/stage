import { PROXY_ROUTES, UPLOAD_MAX_BYTES } from '@stage-labs/client/endpoints';
import { corsHeaders, corsResponse, declaredLength, guarded, repliesWith, type HeaderMap } from './respond.ts';

const ATTACHMENTS_PATH = PROXY_ROUTES.attachments;
const ID_BYTES = 24;
const ATTACHMENT_ID = /^[A-Za-z0-9_-]{32}$/;
const CONTENT_TYPE = 'application/octet-stream';
const IMMUTABLE = 'public, max-age=31536000, immutable';
const ATTACHMENT_CORS = corsHeaders('GET, HEAD, POST, OPTIONS');
const { json, text } = repliesWith(ATTACHMENT_CORS);
const KEY_PREFIX = 'attachments/';

type AttachmentRoute = { kind: 'upload' } | { kind: 'file'; id: string };

interface StoredAttachment {
  body: ReadableStream;
  size: number;
  etag: string;
}

export interface AttachmentStore {
  put(id: string, body: ReadableStream): Promise<void>;
  get(id: string): Promise<StoredAttachment | null>;
  head(id: string): Promise<Pick<StoredAttachment, 'size' | 'etag'> | null>;
}

function objectKey(id: string): string {
  return `${KEY_PREFIX}${id}`;
}

export function r2AttachmentStore(bucket: R2Bucket): AttachmentStore {
  return {
    put: async (id, body) => {
      await bucket.put(objectKey(id), body, { httpMetadata: { contentType: CONTENT_TYPE } });
    },
    get: async (id) => {
      const object = await bucket.get(objectKey(id));
      return object === null ? null : { body: object.body, size: object.size, etag: object.httpEtag };
    },
    head: async (id) => {
      const object = await bucket.head(objectKey(id));
      return object === null ? null : { size: object.size, etag: object.httpEtag };
    },
  };
}

export function parseAttachmentRoute(pathname: string, method: string): AttachmentRoute | null {
  if (pathname === ATTACHMENTS_PATH) return method === 'POST' ? { kind: 'upload' } : null;
  if (!pathname.startsWith(`${ATTACHMENTS_PATH}/`)) return null;
  const id = pathname.slice(ATTACHMENTS_PATH.length + 1);
  if (!ATTACHMENT_ID.test(id) || (method !== 'GET' && method !== 'HEAD')) return null;
  return { kind: 'file', id };
}

export function newAttachmentId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(ID_BYTES));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

async function upload(request: Request, store: AttachmentStore): Promise<Response> {
  const size = declaredLength(request);
  if (size === null) return text('content length required', 411);
  if (size > UPLOAD_MAX_BYTES) return text('attachment too large', 413);
  if (size < 1 || request.body === null) return text('empty attachment', 400);
  const id = newAttachmentId();
  await store.put(id, request.body);
  return json({ id });
}

function fileHeaders(meta: Pick<StoredAttachment, 'size' | 'etag'>): HeaderMap {
  return {
    ...ATTACHMENT_CORS,
    'content-type': CONTENT_TYPE,
    'content-length': String(meta.size),
    'cache-control': IMMUTABLE,
    etag: meta.etag,
    'x-content-type-options': 'nosniff',
  };
}

async function download(store: AttachmentStore, id: string, method: string): Promise<Response> {
  if (method === 'HEAD') {
    const meta = await store.head(id);
    return meta === null ? text('not found', 404) : corsResponse(fileHeaders(meta), null, 200);
  }
  const stored = await store.get(id);
  return stored === null ? text('not found', 404) : corsResponse(fileHeaders(stored), stored.body, 200);
}

export async function handleAttachments(request: Request, store: AttachmentStore | undefined): Promise<Response> {
  if (request.method === 'OPTIONS') return text(null, 204);
  const route = parseAttachmentRoute(new URL(request.url).pathname, request.method);
  if (route === null) return text('not found', 404);
  if (store === undefined) return text('attachment storage is not configured', 503);
  return await guarded(
    () => (route.kind === 'upload' ? upload(request, store) : download(store, route.id, request.method)),
    () => text('attachment store error', 502),
  );
}
