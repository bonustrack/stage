/** Self-identity URIs (claude/codex/daemon) + the append-only user registry. */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { errMsg, log } from './log.js';
import { STATE_DIR } from './paths.js';
import { Line } from './lines.js';
import { claudeUserId, claudeSessionId, codexUserId, codexSessionId, codexUserIdOrNull } from './local-identity.js';

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
