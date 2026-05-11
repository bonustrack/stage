/** Per-machine Line → {agent threads, last-used} cache. Keys are URI lines (see docs/uri-scheme.md). */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { errMsg, log } from '../log.js';
import { STATE_DIR } from '../paths.js';
import { station as stationOf } from '../stations/line.js';
import type { Line } from '../stations/types.js';

export type AgentKind = 'codex' | 'claude';

type Entry = {
  createdAt: string;
  /** Watermark of most-recent processed human message; used for catchup-on-restart. */
  lastSeenMessageId?: string;
  /** ISO timestamp of most-recent activity; used by `metro lines` to sort by recency. */
  lastSeenAt?: string;
  agents: Partial<Record<AgentKind, string>>;
  /** Most-recent answering agent; default for the next turn. */
  lastAgent?: AgentKind;
};
type Cache = Record<string, Entry>;

const cacheFile = join(STATE_DIR, 'scopes.json');

function read(): Cache {
  if (!existsSync(cacheFile)) return {};
  try { return JSON.parse(readFileSync(cacheFile, 'utf8')) as Cache; }
  catch (err) { log.warn({ err: errMsg(err), path: cacheFile }, 'scope cache read failed; treating as empty'); return {}; }
}

function write(cache: Cache): void {
  try { writeFileSync(cacheFile, JSON.stringify(cache, null, 2)); }
  catch (err) { log.warn({ err: errMsg(err), path: cacheFile }, 'scope cache write failed'); }
}

function ensure(cache: Cache, line: Line): Entry {
  if (!cache[line]) cache[line] = { createdAt: new Date().toISOString(), agents: {} };
  if (!cache[line].agents) cache[line].agents = {};
  return cache[line];
}

export const getAgentThread = (line: Line, kind: AgentKind): string | undefined => read()[line]?.agents?.[kind];

export function setAgentThread(line: Line, kind: AgentKind, threadId: string): void {
  const cache = read(); const entry = ensure(cache, line);
  entry.agents[kind] = threadId; entry.lastAgent = kind;
  write(cache);
}

export const getLastAgent = (line: Line): AgentKind | undefined => read()[line]?.lastAgent;

export function setLastAgent(line: Line, kind: AgentKind): void {
  const cache = read(); if (!cache[line]) return;
  cache[line].lastAgent = kind; write(cache);
}

export function setLastSeen(line: Line, messageId: string): void {
  const cache = read(); if (!cache[line]) return;
  cache[line].lastSeenMessageId = messageId;
  cache[line].lastSeenAt = new Date().toISOString();
  write(cache);
}

export const listLines = (): Array<{ line: Line; entry: Entry }> =>
  Object.entries(read()).map(([line, entry]) => ({ line: line as Line, entry }));

export const linesForStation = (name: string): Array<{ line: Line; entry: Entry }> =>
  listLines().filter(({ line }) => stationOf(line) === name);
