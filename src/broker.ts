/** Broker primitives: claims map + per-user byte-offset cursors over history.jsonl. */

import {
  closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { log } from './log.js';
import { STATE_DIR } from './paths.js';
import { Line } from './stations/index.js';
import type { HistoryEntry } from './history.js';

export const CLAIMS_FILE = join(STATE_DIR, 'claims.json');
const CLAIMS_LOCK = join(STATE_DIR, 'claims.json.lock');
const CURSORS_DIR = join(STATE_DIR, 'cursors');
export const HISTORY_FILE = join(STATE_DIR, 'history.jsonl');

export type ClaimsMap = Record<string, Line>;
export type Mode = 'all' | 'mine-or-unclaimed' | 'mine-only' | 'unclaimed';

/** Read claims.json. Empty map on missing or malformed; one retry covers a write race. */
export function readClaims(): ClaimsMap {
  if (!existsSync(CLAIMS_FILE)) return {};
  for (let i = 0; i < 2; i++) {
    try { return JSON.parse(readFileSync(CLAIMS_FILE, 'utf8')) as ClaimsMap; } catch { /* retry on race */ }
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

/**
 * Claim `line` for `owner` iff unclaimed. Statuses: claimed | kept | skipped | error.
 */
export type AutoClaimResult =
  | { status: 'claimed' | 'kept'; owner: Line }
  | { status: 'skipped'; existing: Line }
  | { status: 'error'; error: string };

export function tryAutoClaim(line: Line, owner: Line): AutoClaimResult {
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

/** Filename-safe path for a participant URI's cursor. `metro://claude/user/9bfc…` → `<dir>/claude-user-9bfc…`. */
const cursorPath = (uri: Line): string =>
  join(CURSORS_DIR, uri.replace(/^metro:\/+/, '').replace(/[^A-Za-z0-9_.-]/g, '-'));

export function readCursor(uri: Line): number {
  const p = cursorPath(uri);
  if (!existsSync(p)) return 0;
  const n = Number(readFileSync(p, 'utf8').trim());
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function writeCursor(uri: Line, offset: number): void {
  mkdirSync(CURSORS_DIR, { recursive: true });
  const p = cursorPath(uri);
  const tmp = `${p}.tmp.${process.pid}`;
  writeFileSync(tmp, String(offset));
  renameSync(tmp, p);
}

/** Byte size of history.jsonl right now (for `--since=tail`). */
export function historySize(): number {
  return existsSync(HISTORY_FILE) ? statSync(HISTORY_FILE).size : 0;
}

/** Yield each complete JSONL entry from `offset` to EOF, with the byte offset right after each `\n`. */
export function* readEntriesFrom(offset: number): Generator<{ entry: HistoryEntry; offset: number }> {
  if (!existsSync(HISTORY_FILE)) return;
  const buf = readFileSync(HISTORY_FILE);
  let pos = offset;
  while (pos < buf.length) {
    const nl = buf.indexOf(0x0a, pos);
    const end = nl === -1 ? buf.length : nl;
    const raw = buf.subarray(pos, end).toString('utf8').trim();
    pos = end + 1;
    if (!raw) continue;
    try { yield { entry: JSON.parse(raw) as HistoryEntry, offset: pos }; }
    catch { log.warn('broker: skipped malformed history line'); }
  }
}

/** Claim-aware filter. Webhooks excluded from personal modes unless `includeWebhooks`. */
export function passesMode(
  event: HistoryEntry,
  mode: Mode,
  self: Line | null,
  claims: ClaimsMap,
  opts: { includeWebhooks?: boolean } = {},
): boolean {
  if (self && event.to === self) return true;
  if (mode === 'all') return true;
  if (mode === 'unclaimed') return !claims[event.line];
  if (event.station === 'webhook' && !opts.includeWebhooks) return false;
  const owner = claims[event.line];
  if (mode === 'mine-only') return owner === self;
  return !owner || owner === self;
}
