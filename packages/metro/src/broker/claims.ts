/** Claims map: per-line owner registry under an O_EXCL lockfile. */

import {
  closeSync, existsSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { log } from '../log.js';
import { STATE_DIR } from '../paths.js';
import { Line } from '../lines.js';
import type { HistoryEntry } from '../history.js';

export const CLAIMS_FILE = join(STATE_DIR, 'claims.json');
const CLAIMS_LOCK = join(STATE_DIR, 'claims.json.lock');
export const HISTORY_FILE = join(STATE_DIR, 'history.jsonl');

export type ClaimsMap = Record<string, Line>;

/** Read claims.json. Returns empty map if missing or malformed (retries once on race). */
export function readClaims(): ClaimsMap {
  if (!existsSync(CLAIMS_FILE)) return {};
  for (let attempt = 0; attempt < 2; attempt++) {
    try { return JSON.parse(readFileSync(CLAIMS_FILE, 'utf8')) as ClaimsMap; }
    catch { /* race with writer — retry once */ }
  }
  log.warn({ path: CLAIMS_FILE }, 'claims: malformed, treating as empty');
  return {};
}

/** Mutate claims under an O_EXCL lockfile. Throws if another writer holds the lock past timeout. */
function withClaimsLock<T>(fn: (m: ClaimsMap) => T): T {
  const deadline = Date.now() + 2_000;
  while (true) {
    try { closeSync(openSync(CLAIMS_LOCK, 'wx')); break; }
    catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err;
      if (Date.now() > deadline) throw new Error('claims.json: lock contention (held >2s)');
    }
  }
  try {
    const next = readClaims();
    const result = fn(next);
    /** atomic publish: tmpfile + rename so readers never see a half-written file */
    const tmp = `${CLAIMS_FILE}.tmp.${process.pid}`;
    writeFileSync(tmp, JSON.stringify(next, null, 2) + '\n');
    renameSync(tmp, CLAIMS_FILE);
    return result;
  } finally {
    try { unlinkSync(CLAIMS_LOCK); } catch { /* ignore */ }
  }
}

export function claimLine(line: Line, owner: Line): ClaimsMap {
  return withClaimsLock(m => { m[line] = owner; return m; });
}

export function releaseLine(line: Line): { released: boolean; claims: ClaimsMap } {
  return withClaimsLock(m => {
    const released = line in m;
    delete m[line];
    return { released, claims: m };
  });
}

/** Claim `line` for `owner` iff unclaimed. `group`/`webhook` are *protective skips* (the line is */
/** shared, claiming would lock out other claimants); `skipped` is the existing-owner case. Callers */
/** should print a stderr note for `group` so the operator knows `--claim` would have claimed. */
export type AutoClaimResult =
  | { status: 'claimed' | 'kept'; owner: Line }
  | { status: 'skipped'; existing: Line }
  | { status: 'group'; line: Line }
  | { status: 'webhook'; line: Line }
  | { status: 'error'; error: string };

/** Coarse classification of a chat line's topology — DM (1:1) vs group (shared). */
export type LineKind = 'dm' | 'group' | 'unknown';

/** Classify a chat line as DM/group/unknown for the auto-claim group-skip rule. */
/** TG: chatId<0⇒group. Discord: peek payload.guildId on most-recent inbound. Claude/Codex⇒dm. */
export function classifyLine(line: Line): LineKind {
  const station = Line.station(line);
  if (station === 'telegram') {
    const parsed = Line.parseTelegram(line);
    if (!parsed) return 'unknown';
    return parsed.chatId < 0 ? 'group' : 'dm';
  }
  if (station === 'claude' || station === 'codex') return 'dm';
  if (station === 'webhook') return 'group';
  if (station === 'discord') {
    /** Lazy tail-scan of history.jsonl to avoid a static dep on the history filter helpers. */
    const recent = readRecentInbound(line);
    if (!recent) return 'unknown';
    const payload = recent.payload as { guildId?: string | null } | undefined;
    if (!payload || !('guildId' in payload)) {
      /** Older entries may not have a guildId — fall back to the `to` field: DMs route to a user URI. */
      if (recent.to && recent.to !== recent.line) return 'dm';
      return 'unknown';
    }
    return payload.guildId == null ? 'dm' : 'group';
  }
  return 'unknown';
}

/** Most-recent inbound (from-someone-else) on `line`. Walks `history.jsonl` from the tail. */
function readRecentInbound(line: Line): HistoryEntry | undefined {
  if (!existsSync(HISTORY_FILE)) return undefined;
  const lines = readFileSync(HISTORY_FILE, 'utf8').split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    if (!lines[i].trim()) continue;
    try {
      const e = JSON.parse(lines[i]) as HistoryEntry;
      if (e.line === line && !Line.isLocal(e.from)) return e;
    } catch { /* skip */ }
  }
  return undefined;
}

/** Per-line decision: should auto-claim run on a successful outbound? */
function shouldAutoClaim(line: Line, kind: LineKind): { ok: true } | { ok: false; reason: 'group' | 'webhook' } {
  const station = Line.station(line);
  /** Webhook lines are a broadcast stream — claiming one is a footgun. */
  if (station === 'webhook') return { ok: false, reason: 'webhook' };
  /** Claude/Codex cross-user lines are 1:1 by construction — always safe. */
  if (station === 'claude' || station === 'codex') return { ok: true };
  if (kind === 'group') return { ok: false, reason: 'group' };
  return { ok: true };
}

export function tryAutoClaim(
  line: Line,
  owner: Line,
  opts: { lineKind?: LineKind; force?: boolean } = {},
): AutoClaimResult {
  if (!opts.force) {
    const decision = shouldAutoClaim(line, opts.lineKind ?? 'unknown');
    if (!decision.ok) return { status: decision.reason, line };
  }
  try {
    return withClaimsLock(m => {
      const existing = m[line];
      if (existing && existing !== owner) return { status: 'skipped', existing } as const;
      if (existing === owner) return { status: 'kept', owner } as const;
      m[line] = owner;
      return { status: 'claimed', owner } as const;
    });
  } catch (err) {
    return { status: 'error', error: (err as Error).message };
  }
}
