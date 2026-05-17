/** Append-only registry of `(station, user-id, sessions[])` tuples metro has seen. */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { STATE_DIR } from './paths.js';
import { Line } from './lines.js';
import { errMsg, log } from './log.js';

const REGISTRY_FILE = join(STATE_DIR, 'user-registry.json');

export type UserInstance = { userId: string; sessions: string[]; lastSeen: string };
export type Registry = Record<string, UserInstance[]>;

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

export function listUsers(station: 'claude' | 'codex'): UserInstance[] {
  return readRegistry()[station] ?? [];
}
