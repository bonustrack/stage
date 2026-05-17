/** Per-user byte-offset cursors over history.jsonl + claim-aware mode filter. */

import {
  closeSync, existsSync, mkdirSync, openSync, readFileSync, readSync, renameSync, watch, writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { errMsg, log } from '../log.js';
import { STATE_DIR } from '../paths.js';
import { Line } from '../lines.js';
import type { HistoryEntry } from '../history.js';
import { HISTORY_FILE, readClaims, type ClaimsMap } from './claims.js';

const CURSORS_DIR = join(STATE_DIR, 'cursors');

export type Mode = 'all' | 'mine-or-unclaimed' | 'mine-only' | 'unclaimed';

/** Filename-safe slug for a participant URI. `metro://claude/user/9bfc…` → `claude-user-9bfc…`. */
export function userSlug(uri: Line): string {
  return uri.replace(/^metro:\/+/, '').replace(/[^A-Za-z0-9_.-]/g, '-');
}

/** Cursor key for a tail invocation. Derived from the *effective mode*, NOT from `userSelf()`. */
/** Keeps `--all` / `--unclaimed` from trampling a `--as=<id>` cursor in a CLAUDECODE shell. */
/** Keys: `--as=<id>`→slug(id); `+--strict`→slug+`--strict`; `--unclaimed`→`_unclaimed`; `--all`→`_all`. */
/** The `_` prefix can't collide with a userSlug (always has a station prefix like `claude-user-…`). */
/** `--include-webhooks` adds `--with-webhooks` so toggling mid-stream doesn't re-emit/skip events. */
export function cursorKey(
  mode: Mode,
  self: Line | null,
  opts: { includeWebhooks?: boolean } = {},
): string | null {
  if (mode === 'all') return '_all';
  if (mode === 'unclaimed') return '_unclaimed';
  if (!self) return null;
  const base = userSlug(self);
  const suffix = mode === 'mine-only' ? '--strict' : '';
  const webhooks = opts.includeWebhooks ? '--with-webhooks' : '';
  return `${base}${suffix}${webhooks}`;
}

const cursorPath = (key: string): string => join(CURSORS_DIR, key);

export function readCursor(key: string): number {
  const p = cursorPath(key);
  if (!existsSync(p)) return 0;
  const n = Number(readFileSync(p, 'utf8').trim());
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function writeCursor(key: string, offset: number): void {
  mkdirSync(CURSORS_DIR, { recursive: true });
  const p = cursorPath(key);
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
  return !owner || owner === self;  /** mode === 'mine-or-unclaimed' */
}

export type TailOpts = {
  mode: Mode; self: Line | null;
  chatFilter?: string; stationFilter?: string; includeWebhooks?: boolean;
};

/** Drain matching entries from `offset` to EOF, returning the new offset. */
/** Caller `onEntry` may return `true` to stop draining early (e.g. tail --limit). */
export function drainTail(
  offset: number, opts: TailOpts, onEntry: (e: HistoryEntry) => void | boolean,
): number {
  const claims = readClaims();
  for (const { entry, offset: next } of readEntriesFrom(offset)) {
    offset = next;
    if (opts.chatFilter && entry.line !== opts.chatFilter) continue;
    if (opts.stationFilter && entry.station !== opts.stationFilter) continue;
    if (!passesMode(entry, opts.mode, opts.self, claims, { includeWebhooks: opts.includeWebhooks })) continue;
    if (onEntry(entry) === true) return offset;
  }
  return offset;
}

/** Follow history.jsonl: drain on change + poll backstop (macOS fs.watch coalesces). */
/** Caller invokes the returned `stop()` to clean up the watcher/timer. */
export function followTail(
  startOffset: number, opts: TailOpts, onEntry: (e: HistoryEntry) => void, pollMs: number,
): () => void {
  let offset = startOffset;
  const tick = (): void => { offset = drainTail(offset, opts, onEntry); };
  let watcher: ReturnType<typeof watch> | null = null;
  try { watcher = watch(HISTORY_FILE, () => tick()); } catch { /* file may not exist yet */ }
  const poll = setInterval(tick, pollMs);
  return () => {
    clearInterval(poll);
    if (watcher) { try { watcher.close(); } catch { /* ignore */ } }
  };
}
