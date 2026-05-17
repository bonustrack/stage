/** Append-only JSONL history of every message that flows through metro (inbound + outbound). */

import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { errMsg, log } from './log.js';
import { STATE_DIR } from './paths.js';
import { Line } from './lines.js';

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

/** Find an entry by universal id OR platform message id. */
export function lookupEntry(id: string): HistoryEntry | undefined {
  const entries = readHistory({ limit: 5_000 });
  return entries.find(e => e.id === id || e.messageId === id);
}

/** Look up the platform messageId for a universal `msg_*` id; returns the input unchanged otherwise. */
export function resolvePlatformId(id: string): string {
  if (!id.startsWith('msg_')) return id;
  const hit = lookupEntry(id);
  if (hit?.messageId) return hit.messageId;
  throw new Error(`unknown universal id: ${id} (run \`metro history --limit=50\` to see recent ids)`);
}

/** The current user's **participant** URI for `from`/`to`. Precedence: METRO_FROM > runtime env > generic. */
export function userSelf(): Line {
  const explicit = process.env.METRO_FROM;
  if (explicit) return explicit as Line;
  if (process.env.CLAUDECODE) { try { return Line.user('claude', claudeUserId()); } catch { /* fall through */ } }
  if (process.env.METRO_CODEX_RC || process.env.CODEX_HOME) {
    try { return Line.user('codex', codexUserId()); } catch { /* fall through */ }
  }
  return 'metro://user' as Line;
}

/** The current user's **line** URI `<user-id>/<session>`. Null until session is known. */
export function selfLine(): Line | null {
  if (process.env.CLAUDECODE) {
    try { const s = claudeSessionId(); return s ? Line.claude(claudeUserId(), s) : null; } catch { return null; }
  }
  if (process.env.METRO_CODEX_RC || process.env.CODEX_HOME) {
    try { const s = codexSessionId(); return s ? Line.codex(codexUserId(), s) : null; } catch { return null; }
  }
  return null;
}

function claudeUserId(): string {
  if (process.env.METRO_USER_ID) return process.env.METRO_USER_ID;
  const raw = execFileSync('claude', ['auth', 'status', '--json'],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const parsed = JSON.parse(raw) as { loggedIn?: boolean; orgId?: string };
  if (!parsed.loggedIn || !parsed.orgId) throw new Error('claude not logged in');
  return parsed.orgId;
}

function claudeSessionId(): string | null {
  return process.env.METRO_USER_SESSION_ID || process.env.CLAUDE_CODE_SESSION_ID || null;
}

function codexUserId(): string {
  if (process.env.METRO_USER_ID) return process.env.METRO_USER_ID;
  const path = join(process.env.CODEX_HOME || join(homedir(), '.codex'), 'auth.json');
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as { tokens?: { account_id?: string } };
  const id = parsed.tokens?.account_id;
  if (!id) throw new Error('codex not logged in');
  return id;
}

function codexSessionId(): string | null {
  if (process.env.METRO_USER_SESSION_ID) return process.env.METRO_USER_SESSION_ID;
  const sessionFile = join(STATE_DIR, 'stations', 'codex', 'session-id');
  try { return readFileSync(sessionFile, 'utf8').trim() || null; } catch { return null; }
}
