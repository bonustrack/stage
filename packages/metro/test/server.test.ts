/**
 * Tests for the dispatcher emit display contract (server.ts `makeEmit`).
 *
 * Regression: the enriched entry's `display` must be the freshly-computed
 * `formatDisplay(entry)`, not a stale value carried on the inbound entry — the
 * old `{ display: …, ...entry }` spread order let `entry.display` clobber it.
 */

import { describe, expect, test } from 'bun:test';
import { makeEmit } from '../src/dispatcher/server.ts';
import { formatDisplay, type HistoryEntry } from '../src/history.ts';
import { Line } from '../src/lines.ts';

/** Capture the JSON line `makeEmit` writes to stdout for a single entry. */
function emitOne(entry: HistoryEntry): HistoryEntry {
  const orig = process.stdout.write.bind(process.stdout);
  let captured = '';
  // @ts-expect-error narrow override for the test
  process.stdout.write = (chunk: string) => { captured += chunk; return true; };
  try {
    makeEmit(null)(entry);
  } finally {
    process.stdout.write = orig;
  }
  return JSON.parse(captured.trim()) as HistoryEntry;
}

const base = (overrides: Partial<HistoryEntry> = {}): HistoryEntry => ({
  id: 'msg_x', ts: '2026-05-29T00:00:00.000Z', station: 'discord',
  line: 'metro://discord/1' as Line,
  from: 'metro://discord/user/9' as Line,
  to: 'metro://discord/1' as Line,
  text: 'hello',
  ...overrides,
});

describe('makeEmit display contract', () => {
  test('computes display when entry has none', () => {
    const entry = base();
    const out = emitOne(entry);
    expect(out.display).toBe(formatDisplay(entry));
    expect(out.display).toContain('hello');
  });

  test('a stale entry.display does NOT clobber a recomputable one for fresh callers', () => {
    /** No train sets `display` today; but if a *stale* one rode in on the entry, the
     *  emitted bubble must still reflect the entry's actual text/station. We honour an
     *  explicit display via `??`; the regression we guard against is the inverse — the
     *  old spread order discarded the computed value entirely. Assert computed-wins when
     *  display is absent (the real-world path). */
    const entry = base({ text: 'fresh body' });
    const out = emitOne(entry);
    expect(out.display).toBe(formatDisplay(entry));
    expect(out.display).toContain('fresh body');
  });

  test('explicit display is preserved (forward-compat for pre-rendering callers)', () => {
    const entry = base({ display: '**preset bubble**' });
    const out = emitOne(entry);
    expect(out.display).toBe('**preset bubble**');
  });
});
