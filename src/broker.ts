/** Broker primitives: claims map + per-user byte-offset cursors over history.jsonl. */

import {
  closeSync, existsSync, openSync, readFileSync, readSync, renameSync, unlinkSync, writeFileSync,
} from 'node:fs';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { errMsg, log } from './log.js';
import { STATE_DIR } from './paths.js';
import { Line } from './stations/index.js';
import type { HistoryEntry } from './history.js';

export const CLAIMS_FILE = join(STATE_DIR, 'claims.json');
const CLAIMS_LOCK = join(STATE_DIR, 'claims.json.lock');
const CURSORS_DIR = join(STATE_DIR, 'cursors');
export const HISTORY_FILE = join(STATE_DIR, 'history.jsonl');

export type ClaimsMap = Record<string, Line>;
export type Mode = 'all' | 'mine-or-unclaimed' | 'mine-only' | 'unclaimed';

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

/** Filename-safe slug for a participant URI. `metro://claude/user/9bfc…` → `claude-user-9bfc…`. */
export function userSlug(uri: Line): string {
  return uri.replace(/^metro:\/+/, '').replace(/[^A-Za-z0-9_.-]/g, '-');
}

const cursorPath = (uri: Line): string => join(CURSORS_DIR, userSlug(uri));

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
  if (!existsSync(HISTORY_FILE)) return 0;
  try { return readFileSync(HISTORY_FILE).length; }
  catch { return 0; }
}

/** Yield each complete JSONL line from `offset` to EOF; the returned offset is the position right after the `\n`. */
export function* readEntriesFrom(offset: number): Generator<{ entry: HistoryEntry; offset: number }> {
  if (!existsSync(HISTORY_FILE)) return;
  const fd = openSync(HISTORY_FILE, 'r');
  try {
    const chunk = Buffer.alloc(64 * 1024);
    let pending = Buffer.alloc(0);
    let pos = offset;
    while (true) {
      const n = readSync(fd, chunk, 0, chunk.length, pos);
      if (n === 0) break;
      pending = Buffer.concat([pending, chunk.subarray(0, n)]);
      pos += n;
      let nl;
      while ((nl = pending.indexOf(0x0a)) !== -1) {
        const raw = pending.subarray(0, nl).toString('utf8').trim();
        pending = pending.subarray(nl + 1);
        if (!raw) continue;
        try {
          const entry = JSON.parse(raw) as HistoryEntry;
          /** offsetAfter = read-cursor in file - bytes still in pending buffer */
          yield { entry, offset: pos - pending.length };
        } catch (err) {
          log.warn({ err: errMsg(err) }, 'broker: skipped malformed history line');
        }
      }
    }
  } finally {
    closeSync(fd);
  }
}

/**
 * Claim-aware filter. Webhooks excluded from personal modes unless `includeWebhooks`.
 */
export function passesMode(
  event: HistoryEntry,
  mode: Mode,
  self: Line | null,
  claims: ClaimsMap,
  opts: { includeWebhooks?: boolean } = {},
): boolean {
  if (self && event.to === self) return true;
  if (mode === 'all') return true;
  const isWebhook = event.station === 'webhook';
  if (mode === 'unclaimed') return !claims[event.line];
  /** webhooks are filtered out of personal modes unless opted in */
  if (isWebhook && !opts.includeWebhooks) return false;
  const owner = claims[event.line];
  if (mode === 'mine-only') return owner === self;
  /** mode === 'mine-or-unclaimed' */
  return !owner || owner === self;
}
