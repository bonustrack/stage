/** Tests for the pluggable read-state provider (lib/readState.ts). The default
 *  piggyback+fallback strategy must: derive the cursor as max(last-sent,
 *  fallback); buffer local reads as dirty for the once-per-background drain;
 *  fold remote fallbacks by LWW WITHOUT marking them dirty (no echo). These back
 *  the cross-device unread design where read state is NOT a per-read write.
 *
 *  The provider is a process singleton, so each test uses a UNIQUE conv id to
 *  keep state isolated (and drains between assertions where it matters). */

import { describe, expect, test } from 'bun:test';
import { readState } from '../lib/readState';

let n = 0;
const id = (): string => `conv-${n++}`;

describe('piggyback+fallback provider', () => {
  test('cursorNs = max(lastSentNs, fallback)', () => {
    const p = readState();
    const a = id();
    expect(p.cursorNs(a, 500)).toBe(500); // piggyback only
    p.noteRead(a, 300);
    expect(p.cursorNs(a, 500)).toBe(500); // sent newer than read
    p.noteRead(a, 900);
    expect(p.cursorNs(a, 500)).toBe(900); // read newer than sent
  });

  test('noteRead is monotonic and marks dirty for drain', () => {
    const p = readState();
    const a = id();
    p.noteRead(a, 100);
    p.noteRead(a, 50); // stale, ignored
    expect(p.cursorNs(a, 0)).toBe(100);
    const drained = p.drainFallbackCursors();
    expect(drained[a]).toBe('100');
    // Drained dirty set is cleared.
    expect(p.drainFallbackCursors()[a]).toBeUndefined();
  });

  test('applyRemoteFallback folds LWW but does NOT mark dirty (no echo)', () => {
    const p = readState();
    const a = id();
    p.drainFallbackCursors(); // clear any prior dirt
    p.applyRemoteFallback(a, 700);
    expect(p.cursorNs(a, 0)).toBe(700);
    expect(p.drainFallbackCursors()[a]).toBeUndefined(); // not dirty
    // A newer LOCAL read over the remote value IS dirty.
    p.noteRead(a, 800);
    expect(p.drainFallbackCursors()[a]).toBe('800');
  });

  test('ignores non-positive / non-finite cursors', () => {
    const p = readState();
    const a = id();
    p.noteRead(a, 0);
    p.noteRead(a, Number.NaN);
    p.applyRemoteFallback(a, -5);
    expect(p.cursorNs(a, 0)).toBe(0);
    expect(p.drainFallbackCursors()[a]).toBeUndefined();
  });
});
