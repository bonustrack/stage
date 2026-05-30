/** Append-only JSONL history of every message that flows through metro (inbound + outbound). */

import { randomBytes } from 'node:crypto';
import { appendFileSync, existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { errMsg, log } from './log.js';
import { HISTORY_FILE, STATE_DIR } from './paths.js';
import { Line } from './lines.js';
import { claudeUserId, claudeSessionId, codexUserId, codexSessionId, codexUserIdOrNull } from './local-identity.js';

/** Typed, discriminated event payload alongside legacy `text`/`display`; additive + backward-compat. */
export type StructuredEvent =
  /** A normal chat message. */
  | { type: 'msg' }
  /** An emoji reaction to another message. `emoji` is the reaction glyph. */
  | { type: 'react'; emoji?: string; targetId?: string }
  /** An edit of a previously-sent message. */
  | { type: 'edit'; targetId?: string }
  /** A reply that quotes/threads off another message. */
  | { type: 'reply'; replyTo?: string }
  /** A system/webhook/automation event (e.g. GitHub webhook). */
  | { type: 'system'; source?: string; eventName?: string }
  /** A push-notification delivery acknowledgement. */
  | { type: 'push-ack'; targetId?: string };

export interface HistoryEntry {
  id: string;
  ts: string;
  station: string;
  line: Line;
  /** Optional channel/topic display name (e.g. "infra"). */
  lineName?: string;
  /** Universal participant URI of the sender. */
  from: Line;
  /** Display name (`@alice` / `bonustrack_`) — optional, human-readable. */
  fromName?: string;
  /** Universal recipient URI — almost always the conversation `line`. */
  to: Line;
  text?: string;
  /** Platform-side message id (Discord snowflake, Telegram int). Distinct from universal `id`. */
  messageId?: string;
  replyTo?: string;
  /** Station-native raw message — shape varies per station. Reactions/edits live here too. */
  payload?: unknown;
  /** Pre-rendered chat-bubble markdown — the user's first chat output should be this string verbatim. */
  display?: string;
  /** Typed, discriminated event shape — lets agents branch on kind instead of regexing `display`/`text`. */
  event?: StructuredEvent;
}

/** Derive the structured `event` from an entry's known fields. Best-effort; defaults to `msg`. */
export function classifyEvent(e: HistoryEntry): StructuredEvent {
  if (e.station === 'webhook' && !Line.isLocal(e.from)) {
    const headers = (e.payload as { headers?: Record<string, string> } | undefined)?.headers;
    const eventName = headers?.['x-github-event'] ?? headers?.['x-intercom-topic'];
    return { type: 'system', source: 'webhook', eventName };
  }
  const emoji = (e.payload as { emoji?: string } | undefined)?.emoji
    ?? e.text?.match(/^\[react (.+)\]$/)?.[1];
  if (emoji) return { type: 'react', emoji, targetId: e.replyTo };
  if (e.replyTo) return { type: 'reply', replyTo: e.replyTo };
  return { type: 'msg' };
}

/** Pre-render a chat-bubble line. Direction is derived: from === local agent → outbound (📤), else inbound (📩). */
export function formatDisplay(e: HistoryEntry): string {
  const headerFor = (icon: string, parts: (string | undefined)[]): string =>
    `**${icon} ${parts.filter(Boolean).join(' · ')}**`;
  const body = e.text ?? '';
  if (e.station === 'webhook' && !Line.isLocal(e.from)) {
    const ev = (e.payload as { headers?: Record<string, string> } | undefined)
      ?.headers?.['x-github-event'] ?? (e.payload as { headers?: Record<string, string> } | undefined)
      ?.headers?.['x-intercom-topic'];
    return `${headerFor('🪝', ['webhook', e.lineName, ev])}\n> ${body}`;
  }
  if (Line.isLocal(e.from)) {
    return `${headerFor('📤', [e.station, '→', e.fromName ?? e.to])}\n> ${body}`;
  }
  return `${headerFor('📩', [e.station, e.fromName ?? e.from, e.lineName])}\n> ${body}`;
}

/** Mint a universal metro message ID. Short, prefixed, URL-safe. */
export const mintId = (): string => `msg_${randomBytes(6).toString('base64url')}`;

/** Append one entry as a JSON line. POSIX-atomic for sub-PIPE_BUF writes (we're well under). */
export function appendHistory(entry: HistoryEntry): void {
  try { appendFileSync(HISTORY_FILE, JSON.stringify(entry) + '\n'); }
  catch (err) { log.warn({ err: errMsg(err), path: HISTORY_FILE }, 'history append failed'); }
}

export interface HistoryFilter {
  line?: string;
  station?: string;
  from?: string;
  textContains?: string;
  since?: Date;
  limit?: number;
  /** Skip N most-recent matching entries (pagination: page 2 = skip=20). */
  skip?: number;
}

/** Read JSONL, parse, filter (most-recent-first), apply `skip` then `limit`. Empty array if file is missing. */
export function readHistory(filter: HistoryFilter = {}): HistoryEntry[] {
  if (!existsSync(HISTORY_FILE)) return [];
  const lines = readFileSync(HISTORY_FILE, 'utf8').split('\n');
  const out: HistoryEntry[] = [];
  const skip = filter.skip ?? 0;
  let skipped = 0;
  /** Walk backwards so `limit` clamps without scanning the whole file body twice. */
  for (let i = lines.length - 1; i >= 0; i--) {
    const raw = lines[i].trim();
    if (!raw) continue;
    let e: HistoryEntry;
    try { e = JSON.parse(raw) as HistoryEntry; } catch { continue; }
    if (!matches(e, filter)) continue;
    if (skipped < skip) { skipped++; continue; }
    out.push(e);
    if (filter.limit && out.length >= filter.limit) break;
  }
  return out;
}

/* ──────────── per-line read cursor: O(new) "what's new on this line" ──────────── */

// Append-only jsonl ⇒ byte offset is a stable monotonic cursor; one per line so
// each reader re-parses only its unseen tail (O(new), not O(file)).
const CURSOR_FILE = join(STATE_DIR, 'read-cursors.json');

/** Map of line URI → last-read byte offset into HISTORY_FILE. */
type CursorStore = Record<string, number>;

function readCursors(): CursorStore {
  if (!existsSync(CURSOR_FILE)) return {};
  try { return JSON.parse(readFileSync(CURSOR_FILE, 'utf8')) as CursorStore; }
  catch (err) { log.warn({ err: errMsg(err) }, 'read-cursors: malformed, resetting'); return {}; }
}

function writeCursor(line: string, offset: number): void {
  const store = readCursors();
  store[line] = offset;
  try { writeFileSync(CURSOR_FILE, JSON.stringify(store)); }
  catch (err) { log.warn({ err: errMsg(err) }, 'read-cursors: write failed'); }
}

// Entries appended to `line` since the last call (most-recent-first). Reads only
// the byte tail past the persisted cursor, then advances it to EOF (O(new bytes)).
// `advance:false` peeks without moving the cursor; offset>size ⇒ file rotated, reset.
export function readNewForLine(
  line: string,
  opts: { advance?: boolean } = {},
): HistoryEntry[] {
  if (!existsSync(HISTORY_FILE)) return [];
  const advance = opts.advance ?? true;
  const size = statSync(HISTORY_FILE).size;
  const cursors = readCursors();
  let from = cursors[line] ?? 0;
  if (from > size) from = 0; // file truncated/rotated — restart this line's cursor
  if (from === size) { return []; } // nothing new, no scan

  /** Read only the tail. Slice on the last newline ≤ `from` to avoid a half line. */
  const buf = readFileSync(HISTORY_FILE);
  let start = from;
  if (start > 0) {
    // back up to the byte after the previous newline so we start on a record boundary
    while (start > 0 && buf[start - 1] !== 0x0a) start--;
  }
  const tail = buf.subarray(start, size).toString('utf8');
  const out: HistoryEntry[] = [];
  for (const raw of tail.split('\n')) {
    const t = raw.trim();
    if (!t) continue;
    let e: HistoryEntry;
    try { e = JSON.parse(t) as HistoryEntry; } catch { continue; }
    if (e.line === line) out.push(e);
  }
  if (advance) writeCursor(line, size);
  return out.reverse(); // most-recent-first, matching readHistory
}

/** Reset a line's cursor (next `readNewForLine` re-reads the whole file for it). */
export function resetCursor(line: string): void {
  const store = readCursors();
  if (!(line in store)) return;
  delete store[line];
  try { writeFileSync(CURSOR_FILE, JSON.stringify(store)); } catch { /* noop */ }
}

function matches(e: HistoryEntry, f: HistoryFilter): boolean {
  if (f.line && e.line !== f.line) return false;
  if (f.station && e.station !== f.station) return false;
  if (f.from && e.from !== f.from) return false;
  if (f.textContains && !(e.text ?? '').toLowerCase().includes(f.textContains.toLowerCase())) return false;
  if (f.since && new Date(e.ts) < f.since) return false;
  return true;
}

/** The current user's **participant** URI for `from`/`to`. Precedence: METRO_FROM > runtime env > generic. */
export function userSelf(): Line {
  const explicit = process.env.METRO_FROM;
  if (explicit) return explicit as Line;
  if (process.env.CLAUDECODE) return Line.user('claude', claudeUserId());
  if (process.env.METRO_CODEX_RC || process.env.CODEX_HOME) return Line.user('codex', codexUserId());
  return 'metro://user' as Line;
}

// Self URI for trains (`METRO_SELF_URI`). On the shared multi-account daemon a
// per-CLI identity leaks one account's `from` onto another, so propagate only an
// EXPLICIT self; else hand trains neutral `metro://user` to stamp `from` per account.
export function daemonSelf(): Line {
  const explicit = process.env.METRO_FROM || process.env.METRO_SELF_URI;
  return (explicit ?? 'metro://user') as Line;
}

// Codex user's participant URI, independent of the daemon's own `self`; lets the
// dispatcher gate the Codex bridge to its feed even when the daemon runs neutral.
// Null if no Codex identity resolves — caller should then push nothing.
export function codexSelf(): Line | null {
  const id = codexUserIdOrNull();
  return id ? Line.user('codex', id) : null;
}

/** The current user's **line** URI `<user-id>/<session>`. Null until session is known (rc thread pending). */
export function selfLine(): Line | null {
  if (process.env.CLAUDECODE) {
    const s = claudeSessionId();
    return s ? Line.claude(claudeUserId(), s) : null;
  }
  if (process.env.METRO_CODEX_RC || process.env.CODEX_HOME) {
    const s = codexSessionId();
    return s ? Line.codex(codexUserId(), s) : null;
  }
  return null;
}

/* ──────────── user-registry: append-only (station, userId, sessions[]) tuples ──────────── */

const REGISTRY_FILE = join(STATE_DIR, 'user-registry.json');

type UserInstance = { userId: string; sessions: string[]; lastSeen: string };
type Registry = Record<string, UserInstance[]>;

function readRegistry(): Registry {
  if (!existsSync(REGISTRY_FILE)) return {};
  try { return JSON.parse(readFileSync(REGISTRY_FILE, 'utf8')) as Registry; }
  catch (err) { log.warn({ err: errMsg(err) }, 'user-registry: malformed, resetting'); return {}; }
}

function record(station: 'claude' | 'codex', userId: string, sessionId: string | null): void {
  const reg = readRegistry();
  const rows = (reg[station] ??= []);
  let row = rows.find(r => r.userId === userId);
  if (!row) { row = { userId, sessions: [], lastSeen: '' }; rows.push(row); }
  if (sessionId && !row.sessions.includes(sessionId)) row.sessions.push(sessionId);
  row.lastSeen = new Date().toISOString();
  try { writeFileSync(REGISTRY_FILE, JSON.stringify(reg, null, 2)); }
  catch (err) { log.warn({ err: errMsg(err) }, 'user-registry: write failed'); }
}

/** Scan a line URI for `(station, userId, sessionId)` and record it. No-op on non-user or participant URIs. */
export function noteUserFromLine(line: string): void {
  const station = Line.station(line);
  if (station !== 'claude' && station !== 'codex') return;
  const p = station === 'claude' ? Line.parseClaude(line) : Line.parseCodex(line);
  if (p) record(station, p.userId, p.sessionId);
}
