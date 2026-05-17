/** Append-only JSONL history of every message that flows through metro (inbound + outbound). */

import { randomBytes } from 'node:crypto';
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { errMsg, log } from './log.js';
import { STATE_DIR } from './paths.js';
import { Line } from './lines.js';
import { claudeUserId, claudeSessionId, codexUserId, codexSessionId } from './local-identity.js';

export type HistoryKind = 'inbound' | 'outbound' | 'edit' | 'react';

export interface HistoryEntry {
  id: string;
  ts: string;
  kind: HistoryKind;
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
  emoji?: string;
  /** Platform-side message id (Discord snowflake, Telegram int). Distinct from universal `id`. */
  messageId?: string;
  replyTo?: string;
  /** Station-native raw message — only set on inbound. Shape matches `InboundMessage.payload`. */
  payload?: unknown;
  /** Pre-rendered chat-bubble markdown — the user's first chat output should be this string verbatim. */
  display?: string;
}

/** Pre-render a chat-bubble line — the user echoes `event.display` verbatim instead of composing markdown itself. */
export function formatDisplay(e: HistoryEntry): string {
  const headerFor = (icon: string, parts: (string | undefined)[]): string =>
    `**${icon} ${parts.filter(Boolean).join(' · ')}**`;
  const body = e.text ?? (e.emoji ? `[react ${e.emoji}]` : '');
  if (e.kind === 'inbound' && e.station === 'webhook') {
    const ev = (e.payload as { headers?: Record<string, string> } | undefined)
      ?.headers?.['x-github-event'] ?? (e.payload as { headers?: Record<string, string> } | undefined)
      ?.headers?.['x-intercom-topic'];
    return `${headerFor('🪝', ['webhook', e.lineName, ev])}\n> ${body}`;
  }
  if (e.kind === 'inbound' || (e.kind === 'react' && !Line.isLocal(e.from))) {
    const reactBody = e.kind === 'react' ? `reacted ${e.emoji ?? ''}`.trim() : body;
    return `${headerFor('📩', [e.station, e.fromName ?? e.from, e.lineName])}\n> ${reactBody}`;
  }
  return `${headerFor('📤', [e.station, '→', e.fromName ?? e.to])}\n> ${body}`;
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
  /** Skip N most-recent matching entries (pagination: page 2 = skip=20). */
  skip?: number;
}

/** Read JSONL, parse, filter (most-recent-first), apply `skip` then `limit`. Empty array if file is missing. */
export function readHistory(filter: HistoryFilter = {}): HistoryEntry[] {
  if (!existsSync(FILE)) return [];
  const lines = readFileSync(FILE, 'utf8').split('\n');
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

function matches(e: HistoryEntry, f: HistoryFilter): boolean {
  if (f.line && e.line !== f.line) return false;
  if (f.station && e.station !== f.station) return false;
  if (f.kind && e.kind !== f.kind) return false;
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
