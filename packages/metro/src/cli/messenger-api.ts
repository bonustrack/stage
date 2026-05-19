/** Messenger endpoints: send + register + upload/serve, plus Expo push delivery. */

import { createReadStream, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { extname, join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { createWriteStream } from 'node:fs';
import { mintId, userSelf, type HistoryEntry } from '../history.js';
import { Line } from '../lines.js';
import { errMsg, log } from '../log.js';
import { STATE_DIR } from '../paths.js';

const MESSENGER_LINE = 'metro://messenger/owner' as Line;
const MESSENGER_USER = 'metro://messenger/user/owner' as Line;
const PUSH_TOKENS_FILE = join(STATE_DIR, 'push-tokens.json');
const UPLOADS_DIR = join(STATE_DIR, 'messenger-uploads');
const UPLOAD_MAX = 25 * 1024 * 1024;
mkdirSync(UPLOADS_DIR, { recursive: true });

/** Map MIME prefix → attachment kind. Anything we can't render gets the generic "file" treatment. */
function kindFromMime(mime: string): 'image' | 'audio' | 'video' | 'file' {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('video/')) return 'video';
  return 'file';
}

/** mime → file extension. Best-effort, falls back to '.bin'. */
function extFromMime(mime: string): string {
  const map: Record<string, string> = {
    'image/png': '.png', 'image/jpeg': '.jpg', 'image/jpg': '.jpg',
    'image/webp': '.webp', 'image/gif': '.gif', 'image/heic': '.heic',
    'audio/mp4': '.m4a', 'audio/m4a': '.m4a', 'audio/aac': '.aac',
    'audio/mpeg': '.mp3', 'audio/ogg': '.ogg', 'audio/webm': '.webm', 'audio/wav': '.wav',
    'video/mp4': '.mp4', 'video/webm': '.webm', 'video/quicktime': '.mov',
    'application/pdf': '.pdf', 'application/zip': '.zip',
    'text/plain': '.txt', 'text/markdown': '.md',
  };
  return map[mime.toLowerCase().split(';')[0]] ?? '.bin';
}

function readPushTokens(): string[] {
  try { return existsSync(PUSH_TOKENS_FILE) ? JSON.parse(readFileSync(PUSH_TOKENS_FILE, 'utf8')) as string[] : []; }
  catch { return []; }
}

function writePushTokens(tokens: string[]): void {
  writeFileSync(PUSH_TOKENS_FILE, JSON.stringify([...new Set(tokens)]));
}

async function pushExpo(tokens: string[], title: string, body: string): Promise<void> {
  if (tokens.length === 0) return;
  const messages = tokens.map(to => ({ to, title, body, sound: 'default' }));
  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept-Encoding': 'gzip, deflate' },
      body: JSON.stringify(messages),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) { log.warn({ err: errMsg(err) }, 'expo push failed'); }
}

async function readJsonBody<T>(req: IncomingMessage): Promise<T | { __error: string }> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c as string));
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {} as T;
  try { return JSON.parse(raw) as T; }
  catch (err) { return { __error: `bad JSON body: ${errMsg(err)}` }; }
}

type Send = (res: ServerResponse, req: IncomingMessage, status: number, body: unknown) => void;
type Emit = (entry: HistoryEntry) => void;

interface Attachment { id: string; url: string; kind: string; mime: string; size: number; name?: string }

/** Route all /api/messenger/* paths. Returns true if handled. */
export function routeMessenger(
  req: IncomingMessage, res: ServerResponse, path: string, emit: Emit | undefined, send: Send,
): boolean {
  const guard = (
    p: () => Promise<void> | void, label: string, methodOk: boolean = true,
  ): boolean => {
    if (!methodOk) { send(res, req, 405, { error: 'method not allowed' }); return true; }
    Promise.resolve(p()).catch(err => {
      log.warn({ err: errMsg(err) }, `monitor: ${label} error`);
      try { send(res, req, 500, { error: errMsg(err) }); } catch { /* ignore */ }
    });
    return true;
  };
  if (path === '/api/messenger/send') {
    if (!emit) { send(res, req, 500, { error: 'emit not wired' }); return true; }
    return guard(() => handleMessengerSend(req, res, emit, send), 'messenger-send', req.method === 'POST');
  }
  if (path === '/api/messenger/register') {
    return guard(() => handleMessengerRegister(req, res, send), 'messenger-register', req.method === 'POST');
  }
  if (path === '/api/messenger/upload') {
    return guard(() => handleMessengerUpload(req, res, send), 'messenger-upload', req.method === 'POST');
  }
  const fileMatch = path.match(/^\/api\/messenger\/files\/([^/]+)$/);
  if (fileMatch) {
    if (req.method !== 'GET') { send(res, req, 405, { error: 'method not allowed' }); return true; }
    handleMessengerFile(req, res, decodeURIComponent(fileMatch[1]), send);
    return true;
  }
  return false;
}

export async function handleMessengerSend(
  req: IncomingMessage, res: ServerResponse, emit: Emit, send: Send,
): Promise<void> {
  const body = await readJsonBody<{ text?: string; as?: string; attachments?: Attachment[] }>(req);
  if ('__error' in body) return send(res, req, 400, { error: body.__error });
  const text = (body.text ?? '').trim();
  const attachments = Array.isArray(body.attachments) ? body.attachments : [];
  if (!text && attachments.length === 0) return send(res, req, 400, { error: 'text or attachments required' });
  const fromAgent = body.as === 'agent';
  const agent = userSelf();
  const entry: HistoryEntry = {
    id: mintId(),
    ts: new Date().toISOString(),
    station: 'messenger',
    line: MESSENGER_LINE,
    from: fromAgent ? agent : MESSENGER_USER,
    to: fromAgent ? MESSENGER_USER : agent,
    text: text || undefined,
    ...(attachments.length > 0 ? { payload: { attachments } } : {}),
  };
  emit(entry);
  /** Agent → user: push to registered tokens. User → agent: their own message; skip. */
  if (fromAgent) {
    const summary = text || `[${attachments[0]?.kind ?? 'attachment'}]`;
    void pushExpo(readPushTokens(), 'Metro', summary.slice(0, 200));
  }
  send(res, req, 200, { id: entry.id, line: entry.line });
}

/** Raw binary upload: body = file bytes, headers `Content-Type` and `X-Filename` (optional). */
export async function handleMessengerUpload(
  req: IncomingMessage, res: ServerResponse, send: Send,
): Promise<void> {
  const mime = (req.headers['content-type'] ?? 'application/octet-stream').toString().split(';')[0].trim();
  const declared = Number(req.headers['content-length'] ?? '0');
  if (declared > UPLOAD_MAX) return send(res, req, 413, { error: `upload exceeds ${UPLOAD_MAX} bytes` });
  const name = (req.headers['x-filename'] as string | undefined)?.toString().slice(0, 256);
  const id = mintId();
  const ext = name ? extname(name) || extFromMime(mime) : extFromMime(mime);
  const filename = `${id}${ext}`;
  const dest = join(UPLOADS_DIR, filename);
  let total = 0;
  const out = createWriteStream(dest);
  req.on('data', (chunk: Buffer) => {
    total += chunk.length;
    if (total > UPLOAD_MAX) { req.destroy(new Error('upload too large')); out.destroy(); }
  });
  try {
    await pipeline(req, out);
  } catch (err) {
    try { send(res, req, 413, { error: errMsg(err) }); } catch { /* ignore */ }
    return;
  }
  /** Path-only URL; the client adds host + token. Stable, host-independent across tunnels. */
  const url = `/api/messenger/files/${filename}`;
  send(res, req, 200, { id, url, kind: kindFromMime(mime), mime, size: total, name });
}

/** GET /api/messenger/files/:filename — stream a previously uploaded file back. */
export function handleMessengerFile(
  req: IncomingMessage, res: ServerResponse, filename: string, send: Send,
): void {
  /** Guard path traversal — only basenames allowed. */
  if (filename.includes('/') || filename.includes('..') || !filename) {
    return send(res, req, 400, { error: 'bad filename' });
  }
  const path = join(UPLOADS_DIR, filename);
  if (!existsSync(path)) return send(res, req, 404, { error: 'not found' });
  const stat = statSync(path);
  res.writeHead(200, {
    'content-length': stat.size.toString(),
    'cache-control': 'private, max-age=31536000',
  });
  createReadStream(path).pipe(res);
}

export async function handleMessengerRegister(
  req: IncomingMessage, res: ServerResponse, send: Send,
): Promise<void> {
  const body = await readJsonBody<{ pushToken?: string }>(req);
  if ('__error' in body) return send(res, req, 400, { error: body.__error });
  const token = (body.pushToken ?? '').trim();
  if (!token) return send(res, req, 400, { error: 'pushToken is required' });
  const tokens = readPushTokens();
  if (!tokens.includes(token)) writePushTokens([...tokens, token]);
  send(res, req, 200, { ok: true, count: tokens.includes(token) ? tokens.length : tokens.length + 1 });
}
