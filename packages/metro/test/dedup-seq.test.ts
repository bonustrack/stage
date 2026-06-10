/**
 * Inbound dedup + per-line sequence numbers (Metro protocol improvement #6).
 *
 * Covers: duplicate replay dropped, no-messageId never deduped, seq monotonic
 * per line, restart warm-start (seed from tail keeps replays deduped + seq
 * continuing), and legacy parity (entries otherwise unaffected).
 */

import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeDedupSeq } from '../src/dispatcher/dedup-seq.ts';
import { makeEmit } from '../src/dispatcher/server.ts';
import type { HistoryEntry } from '../src/history.ts';
import { Line } from '../src/lines.ts';

const inbound = (overrides: Partial<HistoryEntry> = {}): HistoryEntry => ({
  id: 'msg_x', ts: '2026-06-10T00:00:00.000Z', station: 'discord',
  line: 'metro://discord/1' as Line,
  from: 'metro://discord/user/9' as Line,
  to: 'metro://discord/1' as Line,
  text: 'hello', messageId: 'plat-1',
  ...overrides,
});

/** Capture every JSON line `makeEmit` writes to stdout for a batch of entries. */
function emitAll(entries: HistoryEntry[], historyPath: string): HistoryEntry[] {
  const orig = process.stdout.write.bind(process.stdout);
  const lines: string[] = [];
  // @ts-expect-error narrow override for the test
  process.stdout.write = (chunk: string) => { lines.push(chunk); return true; };
  const prevHist = process.env.METRO_STATE_DIR;
  try {
    const emit = makeEmit(null, makeDedupSeq(historyPath));
    for (const e of entries) emit(e);
  } finally {
    process.stdout.write = orig;
    if (prevHist === undefined) delete process.env.METRO_STATE_DIR;
    else process.env.METRO_STATE_DIR = prevHist;
  }
  return lines.map(l => JSON.parse(l.trim()) as HistoryEntry);
}

describe('dedup-seq tracker', () => {
  let dir: string;
  let histPath: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'metro-ds-')); histPath = join(dir, 'h.jsonl'); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  test('duplicate replay (same platform id twice) -> one entry, seq from 1', () => {
    const t = makeDedupSeq(histPath);
    const a = t.admit(inbound({ messageId: 'p1' }));
    const b = t.admit(inbound({ messageId: 'p1' }));
    expect(a).toBe(1);
    expect(b).toBeNull();
  });

  test('no messageId is never deduped (each gets its own seq)', () => {
    const t = makeDedupSeq(histPath);
    const a = t.admit(inbound({ messageId: undefined, text: 'x' }));
    const b = t.admit(inbound({ messageId: undefined, text: 'x' }));
    expect(a).toBe(1);
    expect(b).toBe(2);
  });

  test('outbound/local entries are never deduped even with a repeated id', () => {
    const t = makeDedupSeq(histPath);
    const local = inbound({ from: 'metro://claude/main' as Line, messageId: 'same' });
    expect(t.admit(local)).toBe(1);
    expect(t.admit(local)).toBe(2);
  });

  test('seq is monotonic per line and independent across lines', () => {
    const t = makeDedupSeq(histPath);
    const A = 'metro://discord/A' as Line;
    const B = 'metro://discord/B' as Line;
    expect(t.admit(inbound({ line: A, messageId: 'a1' }))).toBe(1);
    expect(t.admit(inbound({ line: B, messageId: 'b1' }))).toBe(1);
    expect(t.admit(inbound({ line: A, messageId: 'a2' }))).toBe(2);
    expect(t.admit(inbound({ line: B, messageId: 'b2' }))).toBe(2);
    expect(t.admit(inbound({ line: A, messageId: 'a3' }))).toBe(3);
  });
});

describe('warm-start from history tail', () => {
  let dir: string;
  let histPath: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'metro-ds-')); histPath = join(dir, 'h.jsonl'); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  test('seed keeps a prior replay deduped and continues seq after a restart', () => {
    const seed = [
      { ...inbound({ messageId: 'p1', seq: 1 }) },
      { ...inbound({ messageId: 'p2', seq: 2 }) },
    ].map(e => JSON.stringify(e)).join('\n') + '\n';
    writeFileSync(histPath, seed);

    const t = makeDedupSeq(histPath);
    // p1 was already seen in the tail -> replay dropped.
    expect(t.admit(inbound({ messageId: 'p1' }))).toBeNull();
    // a fresh message continues the per-line counter from max-seen (2) -> 3.
    expect(t.admit(inbound({ messageId: 'p3' }))).toBe(3);
  });

  test('absent seed file -> counter starts at 1 (legacy parity)', () => {
    expect(existsSync(histPath)).toBe(false);
    const t = makeDedupSeq(histPath);
    expect(t.admit(inbound({ messageId: 'p1' }))).toBe(1);
  });

  test('entries without seq in the tail do not block seq assignment', () => {
    const seed = JSON.stringify(inbound({ messageId: 'old', seq: undefined })) + '\n';
    writeFileSync(histPath, seed);
    const t = makeDedupSeq(histPath);
    // old replay still deduped; seq starts at 1 since no seq seen for the line.
    expect(t.admit(inbound({ messageId: 'old' }))).toBeNull();
    expect(t.admit(inbound({ messageId: 'new' }))).toBe(1);
  });
});

describe('makeEmit integration', () => {
  let dir: string;
  let histPath: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'metro-ds-')); histPath = join(dir, 'h.jsonl'); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  test('emit stamps seq on the wire and drops a duplicate', () => {
    const out = emitAll([
      inbound({ messageId: 'p1', id: 'msg_a' }),
      inbound({ messageId: 'p1', id: 'msg_b' }), // duplicate -> dropped
      inbound({ messageId: 'p2', id: 'msg_c' }),
    ], histPath);
    expect(out.map(e => e.id)).toEqual(['msg_a', 'msg_c']);
    expect(out.map(e => e.seq)).toEqual([1, 2]);
  });

  test('legacy parity: entry without messageId still flows and gets a seq', () => {
    const out = emitAll([inbound({ messageId: undefined, id: 'msg_z' })], histPath);
    expect(out).toHaveLength(1);
    expect(out[0].seq).toBe(1);
    expect(out[0].display).toContain('hello');
  });
});
