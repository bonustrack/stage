/** Append-only registry of `(station, agent-id, sessions[])` tuples metro has seen. */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { STATE_DIR } from './paths.js';
import { Line } from './stations/index.js';
import { errMsg, log } from './log.js';

const REGISTRY_FILE = join(STATE_DIR, 'agent-registry.json');

export type AgentInstance = { agentId: string; sessions: string[]; lastSeen: string };
export type Registry = Record<string, AgentInstance[]>;

function readRegistry(): Registry {
  if (!existsSync(REGISTRY_FILE)) return {};
  try { return JSON.parse(readFileSync(REGISTRY_FILE, 'utf8')) as Registry; }
  catch (err) { log.warn({ err: errMsg(err) }, 'agent-registry: malformed, resetting'); return {}; }
}

function record(station: 'claude' | 'codex', agentId: string, sessionId: string | null): void {
  const reg = readRegistry();
  const rows = (reg[station] ??= []);
  let row = rows.find(r => r.agentId === agentId);
  if (!row) { row = { agentId, sessions: [], lastSeen: '' }; rows.push(row); }
  if (sessionId && !row.sessions.includes(sessionId)) row.sessions.push(sessionId);
  row.lastSeen = new Date().toISOString();
  try { writeFileSync(REGISTRY_FILE, JSON.stringify(reg, null, 2)); }
  catch (err) { log.warn({ err: errMsg(err) }, 'agent-registry: write failed'); }
}

/** Scan a line URI for `(station, agentId, sessionId)` and record it. No-op on non-agent or participant URIs. */
export function noteAgentFromLine(line: string): void {
  const station = Line.station(line);
  if (station !== 'claude' && station !== 'codex') return;
  const p = station === 'claude' ? Line.parseClaude(line) : Line.parseCodex(line);
  if (p) record(station, p.agentId, p.sessionId);
}

export function listAgents(station: 'claude' | 'codex'): AgentInstance[] {
  return readRegistry()[station] ?? [];
}
