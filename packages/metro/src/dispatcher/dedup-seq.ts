// Inbound dedup + per-line sequence numbers (Metro protocol improvement #6).
//
// Two additive guarantees applied at the single dispatcher inbound funnel
// (`makeEmit`'s `emit`), before an entry is written to history:
//
//  1. DEDUP - trains restart often (backoff/crash/edit) and replay recent
//     platform messages, which the dispatcher would otherwise re-mint under a
//     fresh `msg_` id and append again. We keep a bounded LRU of
//     `station|line|messageId` keys and drop a repeat within the window. Only
//     entries that carry a platform `messageId` are eligible; entries WITHOUT
//     one (e.g. `notify`, synthetic events) are NEVER deduped.
//
//  2. SEQ - every appended entry is stamped with a monotonic per-line `seq`
//     (uint, starts at 1). A gap in a line's `seq` => a consumer can tell it
//     missed/dropped messages.
//
// PERSISTENCE (counter choice): both the LRU and the per-line `seq` counters
// are seeded on construction from the TAIL of history.jsonl (last N lines). We
// deliberately avoid a separate state file: the history tail is the source of
// truth, so a tiny counters.json would be a second thing to keep in sync (and
// to corrupt); and dedup only needs to catch *recent* train replays, which by
// definition sit in the tail window, so a wider window buys nothing.
//
// TRADEOFF: a line idle longer than the tail window won't appear in the seed,
// so its counter restarts from 0 (next entry = seq 1) and its old replays are
// no longer deduped. Both are acceptable: stale replays are vanishingly
// unlikely after that long, and a counter restart is observable (a seq <= a
// previously-seen one: rare, bounded, documented) rather than silent corruption.

import { existsSync, openSync, readSync, closeSync, fstatSync } from 'node:fs';
import { Line } from '../lines.js';
import { log } from '../log.js';
import type { HistoryEntry } from '../history.js';

/** How many lines from the end of history.jsonl to seed from on boot. */
const SEED_TAIL_LINES = 2_000;
/** Max distinct dedup keys held in memory. Oldest evicted first (insertion-order Map). */
const LRU_CAP = 2_000;

/** Dedup key for an entry. `null` => not eligible for dedup (no platform id). */
function dedupKey(e: Pick<HistoryEntry, 'station' | 'line' | 'messageId'>): string | null {
  if (!e.messageId) return null;
  return `${e.station} ${e.line} ${e.messageId}`;
}

/** Read the last `maxLines` non-empty lines of a file without loading it all. */
function readTailLines(path: string, maxLines: number): string[] {
  if (!existsSync(path)) return [];
  const fd = openSync(path, 'r');
  try {
    const size = fstatSync(fd).size;
    if (size === 0) return [];
    const chunkSize = 64 * 1024;
    let pos = size;
    let buf = Buffer.alloc(0);
    let newlines = 0;
    // Walk backwards a chunk at a time until we have enough line breaks (or hit BOF).
    while (pos > 0 && newlines <= maxLines) {
      const readLen = Math.min(chunkSize, pos);
      pos -= readLen;
      const chunk = Buffer.alloc(readLen);
      readSync(fd, chunk, 0, readLen, pos);
      buf = Buffer.concat([chunk, buf]);
      for (const b of chunk) if (b === 0x0a) newlines++;
    }
    const lines = buf.toString('utf8').split('\n').filter(l => l.trim());
    return lines.slice(-maxLines);
  } finally {
    closeSync(fd);
  }
}

export interface DedupSeq {
  // Returns `null` if `entry` is a deduped duplicate (caller drops it). Otherwise
  // returns the per-line `seq` to stamp. Eligible entries (those with a platform
  // `messageId`) are recorded in the LRU as a side effect.
  admit(entry: HistoryEntry): number | null;
}

// Build a dedup+seq tracker, seeding both the dedup LRU and the per-line seq
// counters from the tail of the history file at `historyPath`.
export function makeDedupSeq(historyPath: string): DedupSeq {
  /** Insertion-ordered key set; re-insert on hit so the live key stays "warm". */
  const seen = new Map<string, true>();
  /** line -> highest seq stamped so far. */
  const seqByLine = new Map<string, number>();

  let seeded = 0;
  for (const raw of readTailLines(historyPath, SEED_TAIL_LINES)) {
    let e: HistoryEntry;
    try { e = JSON.parse(raw) as HistoryEntry; } catch { continue; }
    seeded++;
    const k = dedupKey(e);
    if (k) {
      seen.delete(k);
      seen.set(k, true);
      while (seen.size > LRU_CAP) seen.delete(seen.keys().next().value as string);
    }
    if (typeof e.seq === 'number' && e.line) {
      const prev = seqByLine.get(e.line) ?? 0;
      if (e.seq > prev) seqByLine.set(e.line, e.seq);
    }
  }
  log.info({ seeded, dedupKeys: seen.size, lines: seqByLine.size }, 'dedup+seq warm-start');

  const isInbound = (e: HistoryEntry): boolean => !Line.isLocal(e.from);

  return {
    admit(entry: HistoryEntry): number | null {
      const key = dedupKey(entry);
      // Dedup only inbound, id-bearing entries - local/outbound + synthetic stay untouched.
      if (key && isInbound(entry)) {
        if (seen.has(key)) {
          log.debug({ station: entry.station, line: entry.line, messageId: entry.messageId },
            'dedup: dropped duplicate inbound message');
          return null;
        }
        seen.set(key, true);
        while (seen.size > LRU_CAP) seen.delete(seen.keys().next().value as string);
      }
      const next = (seqByLine.get(entry.line) ?? 0) + 1;
      seqByLine.set(entry.line, next);
      return next;
    },
  };
}
