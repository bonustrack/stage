/** Per-line read cursor: O(new) "what's new on this line" over the append-only history JSONL. */

import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { errMsg, log } from './log.js';
import { HISTORY_FILE, STATE_DIR } from './paths.js';
import type { HistoryEntry } from './history-types.js';

// Append-only jsonl ⇒ byte offset is a stable monotonic cursor; one per line so
// each reader re-parses only its unseen tail (O(new), not O(file)).
const CURSOR_FILE = join(STATE_DIR, 'read-cursors.json');

/** Map of line URI → last-read byte offset into HISTORY_FILE. */
type CursorStore = Record<string, number>;

function readCursors(): CursorStore {
  if (!existsSync(CURSOR_FILE)) return {};
  try { return JSON.parse(readFileSync(CURSOR_FILE, 'utf8')) as CursorStore; }
  catch (err) { log.warn({ err: errMsg(err) }, 'read-cursors: malformed, resetting'); return {}; }
}

function writeCursor(line: string, offset: number): void {
  const store = readCursors();
  store[line] = offset;
  try { writeFileSync(CURSOR_FILE, JSON.stringify(store)); }
  catch (err) { log.warn({ err: errMsg(err) }, 'read-cursors: write failed'); }
}

// Entries appended to `line` since the last call (most-recent-first). Reads only
// the byte tail past the persisted cursor, then advances it to EOF (O(new bytes)).
// `advance:false` peeks without moving the cursor; offset>size ⇒ file rotated, reset.
export function readNewForLine(
  line: string,
  opts: { advance?: boolean } = {},
): HistoryEntry[] {
  if (!existsSync(HISTORY_FILE)) return [];
  const advance = opts.advance ?? true;
  const size = statSync(HISTORY_FILE).size;
  const cursors = readCursors();
  let from = cursors[line] ?? 0;
  if (from > size) from = 0; // file truncated/rotated — restart this line's cursor
  if (from === size) { return []; } // nothing new, no scan

  /** Read only the tail. Slice on the last newline ≤ `from` to avoid a half line. */
  const buf = readFileSync(HISTORY_FILE);
  let start = from;
  if (start > 0) {
    // back up to the byte after the previous newline so we start on a record boundary
    while (start > 0 && buf[start - 1] !== 0x0a) start--;
  }
  const tail = buf.subarray(start, size).toString('utf8');
  const out: HistoryEntry[] = [];
  for (const raw of tail.split('\n')) {
    const t = raw.trim();
    if (!t) continue;
    let e: HistoryEntry;
    try { e = JSON.parse(t) as HistoryEntry; } catch { continue; }
    if (e.line === line) out.push(e);
  }
  if (advance) writeCursor(line, size);
  return out.reverse(); // most-recent-first, matching readHistory
}

/** Reset a line's cursor (next `readNewForLine` re-reads the whole file for it). */
export function resetCursor(line: string): void {
  const store = readCursors();
  if (!(line in store)) return;
  delete store[line];
  try { writeFileSync(CURSOR_FILE, JSON.stringify(store)); } catch { /* noop */ }
}
