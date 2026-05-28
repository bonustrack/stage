/** CLI: `metro tail / claim / release / claims`. HTTP monitor endpoints live in monitor-api.ts. */

import { existsSync } from 'node:fs';
import { CLAIMS_FILE, claimLine, readClaims, releaseLine } from '../broker/claims.js';
import {
  cursorKey, drainTail, followTail, historySize, readCursor, writeCursor,
  type TailOpts,
} from '../broker/history-stream.js';
import { userSelf, type HistoryEntry } from '../history.js';
import { asLine, Line } from '../lines.js';
import { loadMetroEnv } from '../paths.js';
import { pickMode } from './monitor-api.js';
import { emit, exitErr, flagOne, isJson, need, writeJson, type Flags } from './util.js';

export { handleMonitorRequest } from './monitor-api.js';

export async function cmdTail(_: string[], f: Flags): Promise<void> {
  loadMetroEnv();
  const raw = flagOne(f, 'as');
  const auto = userSelf();
  const self: Line | null = raw !== undefined ? asLine(raw) : auto === 'metro://user' ? null : auto;
  const mode = pickMode(f.strict === true, f.unclaimed === true, f.all === true, self,
    msg => { throw exitErr(`--${msg}`, 1); });
  const excludeFromFlag = flagOne(f, 'exclude-from');
  const tail: TailOpts = {
    mode, self, chatFilter: flagOne(f, 'chat'), stationFilter: flagOne(f, 'station'),
    includeWebhooks: f['include-webhooks'] === true,
    excludeFrom: excludeFromFlag
      ? excludeFromFlag.split(',').map(s => s.trim()).filter(Boolean)
      : undefined,
  };
  const follow = f.follow === true;
  const limit = Number(flagOne(f, 'limit')) || 0;
  const json = isJson(f);
  /** Cursor key derives from effective mode (not userSelf), so --all/--unclaimed don't trample --as. */
  const key = cursorKey(mode, self, { includeWebhooks: tail.includeWebhooks });
  const since = flagOne(f, 'since');
  const sN = since !== undefined && since !== 'tail' ? Number(since) : NaN;
  if (since !== undefined && since !== 'tail' && (!Number.isFinite(sN) || sN < 0)) {
    throw exitErr(`--since must be a byte offset or 'tail' (got '${since}')`, 1);
  }
  /** --since: 'tail'→EOF (live only); <num>→explicit byte offset; omitted→this */
  /** reader's persisted cursor (resume), else 0. CLI tail is stateful. This DIFFERS */
  /** from SSE /api/tail, which defaults to EOF (stateless stream, no cursor). Same */
  /** flag name, two defaults — see monitor-api.ts:handleTail + the tail help text. */
  let offset = since === 'tail' ? historySize() : Number.isFinite(sN) ? sN : key ? readCursor(key) : 0;
  let emitted = 0;
  const onEntry = (entry: HistoryEntry): boolean | void => {
    process.stdout.write((json ? JSON.stringify(entry) : fmtRow(entry)) + '\n');
    if (key) writeCursor(key, offset);
    if (limit && ++emitted >= limit) return true;
  };
  offset = drainTail(offset, tail, onEntry);
  if ((limit && emitted >= limit) || !follow) return;
  await new Promise<void>(resolve => {
    const stop = followTail(offset, tail, e => { if (onEntry(e) === true) finish(); }, 500);
    const finish = (): void => { stop(); resolve(); };
    process.on('SIGINT', finish); process.on('SIGTERM', finish);
    process.stdin.on('end', finish).on('close', finish);
  });
}

function fmtRow(e: HistoryEntry): string {
  const body = e.text ?? '';
  const text = body.length > 80 ? body.slice(0, 79) + '…' : body;
  const who = (e.fromName ?? e.from).padEnd(28).slice(0, 28);
  const where = e.line.padEnd(40).slice(0, 40);
  return `${e.ts.slice(11, 19)}  ${e.id.padEnd(12)}  ${who}  ${where}  ${text}`;
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
  emit(f, released ? `released ${line}` : `${line} was not claimed`,
    { ok: true, released, line, claims });
}

export async function cmdClaims(_: string[], f: Flags): Promise<void> {
  loadMetroEnv();
  const claims = readClaims();
  const entries = Object.entries(claims) as [string, Line][];
  if (isJson(f)) return writeJson({ claims });
  if (!entries.length) {
    process.stdout.write('(no claims — every tail with matching filters receives every event)\n'
      + `file: ${CLAIMS_FILE}${existsSync(CLAIMS_FILE) ? '' : ' (not created yet)'}\n`);
    return;
  }
  const w = Math.max(...entries.map(([l]) => l.length));
  process.stdout.write('metro claims\n\n');
  for (const [l, o] of entries) process.stdout.write(`  ${l.padEnd(w)}  →  ${o}\n`);
  process.stdout.write(`\n${entries.length} claim${entries.length === 1 ? '' : 's'} · ${CLAIMS_FILE}\n`);
}
