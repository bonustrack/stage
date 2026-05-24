/** Channel CRUD endpoints: create / list / mutate membership.
 *  Mounts at /api/channels. Generic primitive — Metro core has no notion of butler/support;
 *  callers pick the right default membership for their use case. */

import { randomBytes } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  addMembers, getPermission, hasMembership, readMembers, removeMembers, setMembers,
  type MembersMap,
} from '../broker/members.js';
import { readHistory } from '../history.js';
import { asLine, Line } from '../lines.js';
import { errMsg, log } from '../log.js';

const BODY_MAX = 64 * 1024;
const CHANNEL_PREFIX = 'metro://messenger/channel/';

type Send = (res: ServerResponse, req: IncomingMessage, status: number, body: unknown) => void;

/** TEAM_WALLETS=0xAlice,0xBob,… → list of `metro://user/eth/<addr>` URIs. Lowercased + deduped.
 *  Empty array if the env var isn't set. Generic helper exposed so the integration layer
 *  (Snapshot widget, butler bot, etc.) can include the team in support-style channels. */
export function readTeamWallets(): Line[] {
  const raw = process.env.TEAM_WALLETS ?? '';
  const addrs = raw.split(',').map(s => s.trim().toLowerCase()).filter(s => /^0x[a-f0-9]{40}$/.test(s));
  return Array.from(new Set(addrs)).map(addr => asLine(`metro://user/eth/${addr}`));
}

function mintChannelId(): string {
  /** 12 base62 chars (~71 bits) — collision-resistant for the realistic ceiling of conversations. */
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = randomBytes(12);
  let out = '';
  for (let i = 0; i < 12; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

async function readJson(req: IncomingMessage): Promise<unknown | { __error: string }> {
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

/** POST /api/channels — create a channel.
 *  Body: `{ members: ["metro://...", ...], permissions?: { uri: 'admin'|'write'|'read' } }`.
 *  Caller (resolved from the JWT or admin token) is auto-added to members + auto-granted admin. */
async function handleCreate(
  req: IncomingMessage, res: ServerResponse, send: Send, requester: Line | null,
): Promise<void> {
  const body = await readJson(req);
  if (body && typeof body === 'object' && '__error' in body) {
    return send(res, req, 400, { error: (body as { __error: string }).__error });
  }
  const { members, permissions } = (body ?? {}) as {
    members?: unknown; permissions?: Record<string, 'admin' | 'write' | 'read'>;
  };
  if (!Array.isArray(members) || members.length === 0 || !members.every(m => typeof m === 'string')) {
    return send(res, req, 400, { error: 'members[] must be a non-empty array of URIs' });
  }
  const memberLines = (members as string[]).map(m => asLine(m));
  /** Auto-include the caller; auto-grant them admin so they can mutate membership later. */
  const finalMembers = requester && !memberLines.includes(requester)
    ? [requester, ...memberLines] : memberLines;
  const finalPerms = { ...(permissions ?? {}) };
  if (requester && !finalPerms[requester]) finalPerms[requester] = 'admin';
  const id = mintChannelId();
  const line = asLine(`${CHANNEL_PREFIX}${id}`);
  setMembers(line, finalMembers, finalPerms);
  log.info({ line, members: finalMembers.length, by: requester ?? 'admin' }, 'channels: created');
  send(res, req, 200, { line, members: finalMembers, permissions: finalPerms });
}

/** GET /api/channels — list channels the requester is in (or all, for admin).
 *  Each entry: `{ line, members[], lastTs }` so the caller can sort by recency client-side. */
function handleList(
  req: IncomingMessage, res: ServerResponse, send: Send, requester: Line | null,
): void {
  const members = readMembers();
  const visible: string[] = [];
  for (const [line, entry] of Object.entries(members)) {
    if (!requester || entry.members.includes(requester)) visible.push(line);
  }
  /** Pull most-recent ts per channel from history.jsonl — bounded by the limit we read. */
  const recent = readHistory({ limit: 500 });
  const lastTs: Record<string, string> = {};
  for (const e of recent) {
    if (visible.includes(e.line) && (!lastTs[e.line] || lastTs[e.line] < e.ts)) lastTs[e.line] = e.ts;
  }
  const channels = visible.map(line => ({
    line,
    members: members[line].members,
    permissions: members[line].permissions ?? {},
    lastTs: lastTs[line] ?? null,
  }));
  channels.sort((a, b) => (b.lastTs ?? '').localeCompare(a.lastTs ?? ''));
  send(res, req, 200, { channels });
}

/** POST /api/channels/:id/members — `{ add?: [...], remove?: [...] }`. Caller must be admin. */
async function handleMutate(
  req: IncomingMessage, res: ServerResponse, send: Send, id: string, requester: Line | null,
): Promise<void> {
  const line = asLine(`${CHANNEL_PREFIX}${id}`);
  const members = readMembers();
  if (!hasMembership(line, members)) return send(res, req, 404, { error: 'channel not found' });
  /** Admin token gets a free pass; user JWT must be the channel's admin. */
  if (requester && getPermission(line, requester, members) !== 'admin') {
    return send(res, req, 403, { error: 'admin permission required' });
  }
  const body = await readJson(req);
  if (body && typeof body === 'object' && '__error' in body) {
    return send(res, req, 400, { error: (body as { __error: string }).__error });
  }
  const { add, remove } = (body ?? {}) as { add?: unknown; remove?: unknown };
  if (Array.isArray(add) && add.length > 0) {
    if (!add.every(u => typeof u === 'string')) return send(res, req, 400, { error: 'add[] must be URIs' });
    addMembers(line, (add as string[]).map(asLine));
  }
  if (Array.isArray(remove) && remove.length > 0) {
    if (!remove.every(u => typeof u === 'string')) return send(res, req, 400, { error: 'remove[] must be URIs' });
    removeMembers(line, (remove as string[]).map(asLine));
  }
  const updated = readMembers()[line];
  send(res, req, 200, { line, members: updated?.members ?? [], permissions: updated?.permissions ?? {} });
}

/** Top-level route: returns true if it handled `/api/channels[...]`. */
export function routeChannels(
  req: IncomingMessage, res: ServerResponse, path: string, send: Send, requester: Line | null,
): boolean {
  if (path === '/api/channels') {
    if (req.method === 'GET') { handleList(req, res, send, requester); return true; }
    if (req.method === 'POST') {
      handleCreate(req, res, send, requester).catch(err => {
        log.warn({ err: errMsg(err) }, 'channels: create handler error');
        try { send(res, req, 500, { error: errMsg(err) }); } catch { /* ignore */ }
      });
      return true;
    }
    send(res, req, 405, { error: 'method not allowed' });
    return true;
  }
  const m = path.match(/^\/api\/channels\/([A-Za-z0-9]+)\/members$/);
  if (m) {
    if (req.method !== 'POST') { send(res, req, 405, { error: 'method not allowed' }); return true; }
    handleMutate(req, res, send, m[1], requester).catch(err => {
      log.warn({ err: errMsg(err) }, 'channels: mutate handler error');
      try { send(res, req, 500, { error: errMsg(err) }); } catch { /* ignore */ }
    });
    return true;
  }
  return false;
}

/** Re-exported so the snapshot integration layer (or anyone else) can resolve
 *  the file's MembersMap shape without importing the broker directly. */
export type { MembersMap };
