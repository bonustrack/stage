/** Append-only JSONL history of every message that flows through metro (inbound + outbound). */

import { randomBytes } from 'node:crypto';
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { errMsg, log } from './log.js';
import { HISTORY_FILE } from './paths.js';
import { Line } from './lines.js';

export { userSelf, daemonSelf, codexSelf, selfLine, noteUserFromLine } from './history-identity.js';
export type { StructuredEvent, WireEvent, HistoryEntry } from './history-types.js';

import type { HistoryEntry, StructuredEvent } from './history-types.js';

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

function matches(e: HistoryEntry, f: HistoryFilter): boolean {
  if (f.line && e.line !== f.line) return false;
  if (f.station && e.station !== f.station) return false;
  if (f.from && e.from !== f.from) return false;
  if (f.textContains && !(e.text ?? '').toLowerCase().includes(f.textContains.toLowerCase())) return false;
  if (f.since && new Date(e.ts) < f.since) return false;
  return true;
}
