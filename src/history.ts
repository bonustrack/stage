/** Append-only JSONL history of every message that flows through metro (inbound + outbound). */

import { randomBytes } from 'node:crypto';
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { errMsg, log } from './log.js';
import { STATE_DIR } from './paths.js';
import { Line } from './stations/index.js';
import { claudeUserId, claudeSessionId } from './stations/claude.js';
import { codexUserId, codexSessionId } from './stations/codex.js';

export type HistoryKind = 'inbound' | 'outbound' | 'edit' | 'react' | 'notification';

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
  if (e.kind === 'notification') {
    return `${headerFor('🔔', ['notification', e.station, e.fromName ?? e.from])}\n> ${body}`;
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
