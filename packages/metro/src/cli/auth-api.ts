/** SIWE → JWT auth: verifies an EIP-4361 signed message, returns a 24h HS256 JWT scoped
 *  to the wallet's `metro://user/eth/<addr>` URI. The JWT is what subsequent requests use
 *  in `Authorization: Bearer …` to opt into membership-scoped tail/state. */

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { join } from 'node:path';
import { SiweMessage } from 'siwe';
import { asLine, Line } from '../lines.js';
import { errMsg, log } from '../log.js';
import { STATE_DIR } from '../paths.js';

const SECRET_FILE = join(STATE_DIR, '.jwt-secret');
const JWT_TTL_SECONDS = 24 * 60 * 60;
const SIWE_MAX_DRIFT_S = 10 * 60;
const BODY_MAX = 16 * 1024;

/** Lazily load (or mint + persist) the HMAC secret used to sign JWTs. */
let cachedSecret: Buffer | null = null;
function jwtSecret(): Buffer {
  if (cachedSecret) return cachedSecret;
  if (existsSync(SECRET_FILE)) {
    cachedSecret = Buffer.from(readFileSync(SECRET_FILE, 'utf8').trim(), 'hex');
    return cachedSecret;
  }
  const fresh = randomBytes(32);
  writeFileSync(SECRET_FILE, fresh.toString('hex'), { mode: 0o600 });
  cachedSecret = fresh;
  log.info({ path: SECRET_FILE }, 'auth: minted JWT signing secret');
  return cachedSecret;
}

function b64url(buf: Buffer | string): string {
  return (typeof buf === 'string' ? Buffer.from(buf) : buf)
    .toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

/** Sign an HS256 JWT with `sub` = the metro user URI. 24h TTL. */
export function signJwt(sub: Line): string {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64url(JSON.stringify({ sub, iat: now, exp: now + JWT_TTL_SECONDS }));
  const sig = b64url(createHmac('sha256', jwtSecret()).update(`${header}.${payload}`).digest());
  return `${header}.${payload}.${sig}`;
}

/** Verify + decode a bearer JWT. Returns the `sub` (metro user URI) or null. */
export function verifyJwt(token: string): Line | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;
  const expected = b64url(createHmac('sha256', jwtSecret()).update(`${h}.${p}`).digest());
  const a = Buffer.from(expected), b = Buffer.from(s);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(b64urlDecode(p).toString('utf8')) as { sub?: string; exp?: number };
    if (!payload.sub || !payload.exp) return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return asLine(payload.sub);
  } catch { return null; }
}

type Send = (res: ServerResponse, req: IncomingMessage, status: number, body: unknown) => void;

async function readBody(req: IncomingMessage): Promise<unknown | { __error: string }> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string);
    total += buf.length;
    if (total > BODY_MAX) return { __error: `body exceeds ${BODY_MAX} bytes` };
    chunks.push(buf);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); }
  catch (err) { return { __error: `bad JSON body: ${errMsg(err)}` }; }
}

/** POST /api/auth/siwe — body: `{ message, signature }`. Verifies the SIWE message against
 *  the signature, recovers the wallet, and returns a JWT scoped to its metro URI. */
export async function handleSiweLogin(
  req: IncomingMessage, res: ServerResponse, send: Send,
): Promise<void> {
  const body = await readBody(req);
  if (body && typeof body === 'object' && '__error' in body) {
    return send(res, req, 400, { error: (body as { __error: string }).__error });
  }
  const { message, signature } = (body ?? {}) as { message?: string; signature?: string };
  if (typeof message !== 'string' || typeof signature !== 'string') {
    return send(res, req, 400, { error: 'message + signature (strings) required' });
  }
  let parsed: SiweMessage;
  try { parsed = new SiweMessage(message); }
  catch (err) { return send(res, req, 400, { error: `bad SIWE message: ${errMsg(err)}` }); }
  /** Reject obviously-stale messages so a leaked signature can't be replayed forever. */
  const issuedAt = parsed.issuedAt ? Date.parse(parsed.issuedAt) / 1000 : 0;
  if (issuedAt && Math.abs(Math.floor(Date.now() / 1000) - issuedAt) > SIWE_MAX_DRIFT_S) {
    return send(res, req, 400, { error: 'SIWE message stale (>10min drift)' });
  }
  try {
    const result = await parsed.verify({ signature });
    if (!result.success) return send(res, req, 401, { error: 'signature verification failed' });
  } catch (err) {
    return send(res, req, 401, { error: `signature verification failed: ${errMsg(err)}` });
  }
  const sub = asLine(`metro://user/eth/${parsed.address.toLowerCase()}`);
  const jwt = signJwt(sub);
  send(res, req, 200, { jwt, sub, expiresIn: JWT_TTL_SECONDS });
}

/** Extract a bearer JWT from the request and resolve it to a requester URI; null if absent/invalid.
 *  Used by monitor-api to set `requester` on tail/state when the caller used a JWT (vs the
 *  admin METRO_MONITOR_TOKEN, which grants unscoped access). */
export function requesterFromJwt(req: IncomingMessage): Line | null {
  const header = ([] as string[]).concat(req.headers['authorization'] ?? [])[0];
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice(7);
  /** A JWT always has 3 dot-separated segments; the admin token is a single hex string, so we
   *  can cheaply skip JWT verification on admin requests without surfacing spurious failures. */
  if (token.split('.').length !== 3) return null;
  return verifyJwt(token);
}
