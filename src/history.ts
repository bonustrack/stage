/** Append-only JSONL history of every message that flows through metro (inbound + outbound). */

import { randomBytes } from 'node:crypto';
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { errMsg, log } from './log.js';
import { STATE_DIR } from './paths.js';
import type { Line } from './stations/index.js';

export type HistoryKind = 'inbound' | 'outbound' | 'edit' | 'react' | 'notification';

export interface HistoryEntry {
  id: string;
  ts: string;
  kind: HistoryKind;
  station: string;
  line: Line;
  /** Universal participant URI of the sender. */
  from: Line;
  /** Display name (`@alice` / `bonustrack_`) — optional, human-readable. */
  fromName?: string;
  /** Universal recipient URI — almost always the conversation `line`. */
  to: Line;
  text?: string;
  emoji?: string;
  platformMessageId?: string;
  replyTo?: string;
}

const FILE = join(STATE_DIR, 'history.jsonl');

/** Mint a universal metro message ID. Short, prefixed, URL-safe. */
export const mintId = (): string => `msg_${randomBytes(6).toString('base64url')}`;

/** Append one entry as a JSON line. POSIX-atomic for sub-PIPE_BUF writes (we're well under). */
export function appendHistory(entry: HistoryEntry): void {
  try { appendFileSync(FILE, JSON.stringify(entry) + '\n'); }
  catch (err) { log.warn({ err: errMsg(err), path: FILE }, 'history append failed'); }
}

export interface HistoryFilter {
  line?: string;
  station?: string;
  kind?: HistoryKind;
  from?: string;
  textContains?: string;
  since?: Date;
  limit?: number;
}

/** Read JSONL, parse, filter (most-recent-first), apply `limit`. Empty array if file is missing. */
export function readHistory(filter: HistoryFilter = {}): HistoryEntry[] {
  if (!existsSync(FILE)) return [];
  const lines = readFileSync(FILE, 'utf8').split('\n');
  const out: HistoryEntry[] = [];
  /** Walk backwards so `limit` clamps without scanning the whole file body twice. */
  for (let i = lines.length - 1; i >= 0; i--) {
    const raw = lines[i].trim();
    if (!raw) continue;
    let e: HistoryEntry;
    try { e = JSON.parse(raw) as HistoryEntry; } catch { continue; }
    if (!matches(e, filter)) continue;
    out.push(e);
    if (filter.limit && out.length >= filter.limit) break;
  }
  return out;
}

function matches(e: HistoryEntry, f: HistoryFilter): boolean {
  if (f.line && e.line !== f.line) return false;
  if (f.station && e.station !== f.station) return false;
  if (f.kind && e.kind !== f.kind) return false;
  if (f.from && e.from !== f.from) return false;
  if (f.textContains && !(e.text ?? '').toLowerCase().includes(f.textContains.toLowerCase())) return false;
  if (f.since && new Date(e.ts) < f.since) return false;
  return true;
}

/** Find an entry by universal id OR platform message id. */
export function lookupEntry(id: string): HistoryEntry | undefined {
  const entries = readHistory({ limit: 5_000 });
  return entries.find(e => e.id === id || e.platformMessageId === id);
}

/** Look up the platform messageId for a universal `msg_*` id; returns the input unchanged otherwise. */
export function resolvePlatformId(id: string): string {
  if (!id.startsWith('msg_')) return id;
  const hit = lookupEntry(id);
  if (hit?.platformMessageId) return hit.platformMessageId;
  throw new Error(`unknown universal id: ${id} (run \`metro history --limit=50\` to see recent ids)`);
}

/** Resolve the current agent's identity URI. Precedence: METRO_FROM > runtime env > generic. */
export function agentSelf(): Line {
  const explicit = process.env.METRO_FROM;
  if (explicit) return explicit as Line;
  if (process.env.CLAUDECODE) return 'metro://claude/agent' as Line;
  if (process.env.METRO_CODEX_RC || process.env.CODEX_HOME) return 'metro://codex/agent' as Line;
  return 'metro://agent' as Line;
}
