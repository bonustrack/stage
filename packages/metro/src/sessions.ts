/** sessions.json BINDING LAYER — maps a named session to a per-station account, */
/** with a derived owner URI `metro://session/<id>`. */
/** ADDITIVE + behavior-preserving: OPT-IN layer, only active when */
/** `~/.metro/sessions.json` EXISTS. When the file is absent (today's reality) */
/** every helper returns null / empty so callers fall back to the existing */
/** per-account owner + env-derived identity behavior, unchanged. Read-only. */

import { existsSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { errMsg, log } from './log.js';
import { asLine, type Line } from './lines.js';
import { STATIONS, type Station } from './messaging.js';
import { claudeSessionId, codexSessionId } from './local-identity.js';

/** Stations a session can bind to an account (the canonical platform set). */
export type SessionStation = Station;
export const SESSION_STATIONS: readonly SessionStation[] = STATIONS;

/** One session's binding: an account id per station, plus an optional default. */
export interface SessionBinding {
  xmtp?: string;
  discord?: string;
  telegram?: string;
  /** Fallback account id for any station not explicitly mapped. */
  default?: string;
}

/** The parsed sessions.json: `{ "<session-id>": { xmtp, discord, telegram, default } }`. */
export type Sessions = Record<string, SessionBinding>;

/** Resolved at call time so $METRO_SESSIONS_FILE overrides (and tests) apply. */
export function sessionsFile(): string {
  return process.env.METRO_SESSIONS_FILE ?? join(homedir(), '.metro', 'sessions.json');
}

/** Owner URI derived from a session id: `metro://session/<id>`. */
export function sessionOwner(sessionId: string): Line {
  return asLine(`metro://session/${sessionId}`);
}

/** True iff a sessions.json file is present (the opt-in switch for this layer). */
export function sessionsPresent(): boolean {
  return existsSync(sessionsFile());
}

/** Warn (once per process) if sessions.json is not 0600 — it can name accounts. */
let warnedPerms = false;
function checkPerms(path: string): void {
  if (warnedPerms) return;
  try {
    const mode = statSync(path).mode & 0o777;
    if (mode & 0o077) {
      warnedPerms = true;
      log.warn({ path, mode: mode.toString(8) }, 'sessions.json should be mode 0600');
    }
  } catch { /* stat failure is non-fatal */ }
}

/** Read + parse sessions.json. Returns {} when ABSENT or malformed (fallback to */
/** today's behavior). Never throws — a bad file must not change daemon routing. */
export function loadSessions(): Sessions {
  const file = sessionsFile();
  if (!existsSync(file)) return {};
  checkPerms(file);
  let raw: unknown;
  try { raw = JSON.parse(readFileSync(file, 'utf8')); }
  catch (err) { log.warn({ err: errMsg(err), path: file }, 'sessions.json: malformed, ignoring'); return {}; }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    log.warn({ path: file }, 'sessions.json: not an object, ignoring');
    return {};
  }
  const out: Sessions = {};
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!v || typeof v !== 'object' || Array.isArray(v)) continue;
    const b = v as Record<string, unknown>;
    const binding: SessionBinding = {};
    for (const k of [...SESSION_STATIONS, 'default'] as const) {
      if (typeof b[k] === 'string' && b[k]) binding[k] = b[k] as string;
    }
    out[id] = binding;
  }
  return out;
}

/** Resolve the account id bound to (session, station). Precedence: explicit */
/** station mapping > session `default`. Null when no sessions.json, the session */
/** is unknown, or the station is unmapped — caller then uses today's behavior. */
export function accountForSession(sessionId: string, station: SessionStation): string | null {
  const binding = loadSessions()[sessionId];
  if (!binding) return null;
  return binding[station] ?? binding.default ?? null;
}

/** The session id active for this process, for binding lookup. Precedence: */
/** explicit `METRO_SESSION` override > the CLI's own claude/codex session id. */
/** Null when none is known — callers then keep today's env-derived behavior. */
export function activeSessionId(): string | null {
  if (process.env.METRO_SESSION) return process.env.METRO_SESSION;
  if (process.env.CLAUDECODE) return claudeSessionId();
  if (process.env.METRO_CODEX_RC || process.env.CODEX_HOME) return codexSessionId();
  return null;
}

/** List session ids present in sessions.json (empty when absent). */
export function listSessions(): Array<{ id: string; owner: Line; binding: SessionBinding }> {
  return Object.entries(loadSessions()).map(([id, binding]) => ({ id, owner: sessionOwner(id), binding }));
}
