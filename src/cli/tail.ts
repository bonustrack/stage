/** CLI subcommands: `metro tail` (claim-aware log subscriber) + `metro claim|release|claims`. */

import { existsSync, watch } from 'node:fs';
import {
  CLAIMS_FILE, HISTORY_FILE, claimLine, historySize, passesMode, readClaims, readCursor,
  readEntriesFrom, releaseLine, writeCursor, type Mode,
} from '../broker.js';
import { userSelf } from '../history.js';
import { asLine, Line } from '../stations/index.js';
import { loadMetroEnv } from '../paths.js';
import { emit, exitErr, flagOne, isJson, need, writeJson, type Flags } from './util.js';

function resolveMode(f: Flags, self: Line | null): Mode {
  const strict = f.strict === true, unclaimed = f.unclaimed === true, all = f.all === true;
  if ([strict, unclaimed, all].filter(Boolean).length > 1) {
    throw exitErr('--strict, --unclaimed, --all are mutually exclusive', 1);
  }
  if (strict) {
    if (!self) throw exitErr('--strict requires --as <user-uri>', 1);
    return 'mine-only';
  }
  if (unclaimed) return 'unclaimed';
  if (all || !self) return 'all';
  return 'mine-or-unclaimed';
}

/** Generic fallback returned by `userSelf()` when there's no Claude/Codex env — treat as "no identity". */
const GENERIC_USER: Line = 'metro://user' as Line;

function resolveSelf(f: Flags): Line | null {
  const raw = flagOne(f, 'as');
  if (raw !== undefined) return asLine(raw);
  const auto = userSelf();
  return auto === GENERIC_USER ? null : auto;
}

function resolveStartOffset(f: Flags, self: Line | null): number {
  const since = flagOne(f, 'since');
  if (since === 'tail') return historySize();
  if (since !== undefined) {
    const n = Number(since);
    if (!Number.isFinite(n) || n < 0) throw exitErr(`--since must be a byte offset or 'tail' (got '${since}')`, 1);
    return n;
  }
  return self ? readCursor(self) : 0;
}

export async function cmdTail(_: string[], f: Flags): Promise<void> {
  loadMetroEnv();
  const self = resolveSelf(f);
  const mode = resolveMode(f, self);
  const follow = f.follow === true;
  const chatFilter = flagOne(f, 'chat');
  const stationFilter = flagOne(f, 'station');
  const limit = Number(flagOne(f, 'limit')) || 0;
  const startOffset = resolveStartOffset(f, self);
  const json = isJson(f);

  let emitted = 0;
  let offset = startOffset;

  const drain = (): boolean => {
    /** read claims once per drain so a burst of events shares a snapshot */
    const claims = readClaims();
    for (const { entry, offset: next } of readEntriesFrom(offset)) {
      offset = next;
      if (chatFilter && entry.line !== chatFilter) continue;
      if (stationFilter && entry.station !== stationFilter) continue;
      if (!passesMode(entry, mode, self, claims)) continue;
      if (json) process.stdout.write(JSON.stringify(entry) + '\n');
      else process.stdout.write(fmtRow(entry) + '\n');
      if (self) writeCursor(self, offset);
      emitted++;
      if (limit && emitted >= limit) return true;
    }
    return false;
  };

  if (drain() && !follow) return;
  if (!follow) return;

  /** fs.watch on macOS sometimes coalesces or drops events — poll every 500ms as a backstop. */
  await new Promise<void>(resolve => {
    let watcher: ReturnType<typeof watch> | null = null;
    const trigger = (): void => { if (drain()) cleanup(); };
    const cleanup = (): void => {
      if (watcher) { try { watcher.close(); } catch { /* ignore */ } watcher = null; }
      clearInterval(poll);
      resolve();
    };
    const poll = setInterval(trigger, 500);
    const startWatcher = (): void => {
      if (!existsSync(HISTORY_FILE)) return;
      try { watcher = watch(HISTORY_FILE, () => trigger()); } catch { /* ignore — poll will catch */ }
    };
    startWatcher();
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    process.stdin.on('end', cleanup).on('close', cleanup);
  });
}

type RowFields = {
  ts: string; id: string; kind: string; line: Line; from: Line; fromName?: string; text?: string; emoji?: string;
};
function fmtRow(e: RowFields): string {
  const ts = e.ts.slice(11, 19);
  const body = e.text ?? (e.emoji ? `[react ${e.emoji}]` : '');
  const text = body.length > 80 ? body.slice(0, 79) + '…' : body;
  const who = (e.fromName ?? e.from).padEnd(28).slice(0, 28);
  const where = e.line.padEnd(40).slice(0, 40);
  return `${ts}  ${e.id.padEnd(12)}  ${e.kind.padEnd(8)}  ${who}  ${where}  ${text}`;
}

export async function cmdClaim(p: string[], f: Flags): Promise<void> {
  loadMetroEnv();
  need(p, 1, 'metro claim <line> [--as <user-uri>]');
  const line = asLine(p[0]);
  const asRaw = flagOne(f, 'as');
  const owner = asRaw ? asLine(asRaw) : userSelf();
  const claims = claimLine(line, owner);
  emit(f, `claimed ${line} → ${owner}`, { ok: true, line, owner, claims });
}

export async function cmdRelease(p: string[], f: Flags): Promise<void> {
  loadMetroEnv();
  need(p, 1, 'metro release <line>');
  const line = asLine(p[0]);
  const { released, claims } = releaseLine(line);
  if (!released) {
    emit(f, `${line} was not claimed`, { ok: true, released: false, line, claims });
    return;
  }
  emit(f, `released ${line}`, { ok: true, released: true, line, claims });
}

export async function cmdClaims(_: string[], f: Flags): Promise<void> {
  loadMetroEnv();
  const claims = readClaims();
  const entries = Object.entries(claims) as [string, Line][];
  if (isJson(f)) return writeJson({ claims });
  if (!entries.length) {
    process.stdout.write('(no claims — every tail with matching filters receives every event)\n');
    process.stdout.write(`file: ${CLAIMS_FILE}${existsSync(CLAIMS_FILE) ? '' : ' (not created yet)'}\n`);
    return;
  }
  const widest = Math.max(...entries.map(([l]) => l.length));
  process.stdout.write('metro claims\n\n');
  for (const [line, owner] of entries) {
    process.stdout.write(`  ${line.padEnd(widest)}  →  ${owner}\n`);
  }
  process.stdout.write(`\n${entries.length} claim${entries.length === 1 ? '' : 's'} · ${CLAIMS_FILE}\n`);
}

