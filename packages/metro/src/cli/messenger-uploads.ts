/** Messenger upload + serve: POST /api/messenger/upload, GET /api/messenger/files/:name. */

import { createReadStream, createWriteStream, existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { extname, join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { mintId } from '../history.js';
import { errMsg, log } from '../log.js';
import { STATE_DIR } from '../paths.js';

const UPLOADS_DIR = join(STATE_DIR, 'messenger-uploads');
const UPLOAD_MAX = 25 * 1024 * 1024;
/** Tunable via env: how long uploaded files stick around before they're pruned (ms). */
const UPLOAD_TTL_MS = Number(process.env.METRO_UPLOAD_TTL_MS ?? String(90 * 24 * 60 * 60 * 1000));
mkdirSync(UPLOADS_DIR, { recursive: true });

/** Best-effort: delete uploads older than UPLOAD_TTL_MS. Called once at module load + periodically. */
function pruneOldUploads(): void {
  const cutoff = Date.now() - UPLOAD_TTL_MS;
  let removed = 0;
  try {
    for (const name of readdirSync(UPLOADS_DIR)) {
      const path = join(UPLOADS_DIR, name);
      try { if (statSync(path).mtimeMs < cutoff) { unlinkSync(path); removed += 1; } }
      catch { /* ignore individual file errors */ }
    }
  } catch { /* dir missing — nothing to prune */ }
  if (removed > 0) log.info({ removed, dir: UPLOADS_DIR }, 'messenger-uploads: pruned old files');
}
pruneOldUploads();
setInterval(pruneOldUploads, 12 * 60 * 60 * 1000).unref();

type Send = (res: ServerResponse, req: IncomingMessage, status: number, body: unknown) => void;

/** Map MIME prefix → attachment kind. */
export function kindFromMime(mime: string): 'image' | 'audio' | 'video' | 'file' {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('video/')) return 'video';
  return 'file';
}

const MIME_TO_EXT: Record<string, string> = {
  'image/png': '.png', 'image/jpeg': '.jpg', 'image/jpg': '.jpg',
  'image/webp': '.webp', 'image/gif': '.gif', 'image/heic': '.heic',
  'audio/mp4': '.m4a', 'audio/m4a': '.m4a', 'audio/aac': '.aac',
  'audio/mpeg': '.mp3', 'audio/ogg': '.ogg', 'audio/webm': '.webm', 'audio/wav': '.wav',
  'video/mp4': '.mp4', 'video/webm': '.webm', 'video/quicktime': '.mov',
  'application/pdf': '.pdf', 'application/zip': '.zip',
  'text/plain': '.txt', 'text/markdown': '.md',
};

/** mime → file extension. Best-effort, falls back to '.bin'. */
function extFromMime(mime: string): string {
  return MIME_TO_EXT[mime.toLowerCase().split(';')[0]] ?? '.bin';
}

/** ext → mime, used when serving uploads so browsers / image tags interpret them correctly. */
function mimeFromExt(ext: string): string {
  const reverse = Object.entries(MIME_TO_EXT).find(([, e]) => e === ext.toLowerCase());
  return reverse ? reverse[0] : 'application/octet-stream';
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
  try { await pipeline(req, out); }
  catch (err) { try { send(res, req, 413, { error: errMsg(err) }); } catch { /* ignore */ } return; }
  /** Path-only URL; the client adds host + token. Stable, host-independent across tunnels.
   *  `localPath` is the absolute server path — useful to agents running on the same host
   *  that want to Read the file directly without the curl/auth roundtrip. Mobile/web
   *  clients ignore the field. */
  send(res, req, 200, {
    id, url: `/api/messenger/files/${filename}`, kind: kindFromMime(mime), mime, size: total, name,
    localPath: dest,
  });
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
  const dot = filename.lastIndexOf('.');
  const ext = dot >= 0 ? filename.slice(dot) : '';
  res.writeHead(200, {
    'content-type': mimeFromExt(ext),
    'content-length': stat.size.toString(),
    'cache-control': 'private, max-age=31536000',
  });
  createReadStream(path).pipe(res);
}
