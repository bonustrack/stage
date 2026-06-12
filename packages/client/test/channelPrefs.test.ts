/** Tests for the pure channel-prefs sync core: per-field last-writer-wins fold,
 *  snapshot compaction floor, and the message builders. These rules back the
 *  cross-device archive/pins/read-cursor sync (apps/app/lib/channelPrefsSync.ts)
 *  and must stay deterministic + commutative regardless of message order. */

import { describe, expect, test } from 'bun:test';
import {
  foldChannelPrefs, toSnapshotEntries, buildPrefDelta, buildReadCursorDelta,
  buildSnapshot, type ChannelPrefsMessage,
} from '../src/xmtp/channelPrefs';

const A = 'conv-a';
const B = 'conv-b';

describe('foldChannelPrefs — per-field LWW', () => {
  test('newest ts wins per field, independently', () => {
    const msgs: ChannelPrefsMessage[] = [
      { v: 1, entries: { [A]: { archived: true, ts: 100 } } },
      { v: 1, entries: { [A]: { pinned: true, ts: 200 } } },
      { v: 1, entries: { [A]: { archived: false, ts: 150 } } },
    ];
    const m = foldChannelPrefs(msgs).get(A)!;
    expect(m.archived).toBe(false); // ts 150 > 100
    expect(m.pinned).toBe(true);
  });

  test('a stale write never clobbers a newer field', () => {
    const msgs: ChannelPrefsMessage[] = [
      { v: 1, entries: { [A]: { archived: true, ts: 300 } } },
      { v: 1, entries: { [A]: { archived: false, ts: 200 } } },
    ];
    expect(foldChannelPrefs(msgs).get(A)!.archived).toBe(true);
  });

  test('order-independent (commutative)', () => {
    const a: ChannelPrefsMessage = { v: 1, entries: { [A]: { pinned: true, ts: 10 } } };
    const b: ChannelPrefsMessage = { v: 1, entries: { [A]: { pinned: false, ts: 20 } } };
    expect(foldChannelPrefs([a, b]).get(A)!.pinned)
      .toBe(foldChannelPrefs([b, a]).get(A)!.pinned);
  });
});

describe('foldChannelPrefs — snapshot floor', () => {
  test('snapshot stamps its entries with the snapshot ts and floors older deltas', () => {
    const msgs: ChannelPrefsMessage[] = [
      { v: 1, entries: { [A]: { archived: true, ts: 50 } } },
      { v: 1, snapshot: true, ts: 100, entries: { [A]: { archived: true, ts: 1 } } },
      { v: 1, entries: { [A]: { archived: false, ts: 80 } } }, // <= floor 100, ignored
    ];
    expect(foldChannelPrefs(msgs).get(A)!.archived).toBe(true);
  });

  test('a delta NEWER than the snapshot still applies', () => {
    const msgs: ChannelPrefsMessage[] = [
      { v: 1, snapshot: true, ts: 100, entries: { [A]: { pinned: true, ts: 1 } } },
      { v: 1, entries: { [A]: { pinned: false, ts: 150 } } },
    ];
    expect(foldChannelPrefs(msgs).get(A)!.pinned).toBe(false);
  });
});

describe('builders', () => {
  test('buildPrefDelta — boolean field', () => {
    const msg = buildPrefDelta(A, 'archived', true, 42);
    expect(msg).toEqual({ v: 1, entries: { [A]: { archived: true, ts: 42 } } });
  });

  test('buildPrefDelta — read cursor coerces to string lastReadNs', () => {
    const msg = buildPrefDelta(A, 'read', '1700000000000000000', 42);
    expect(msg.entries[A]!.lastReadNs).toBe('1700000000000000000');
  });

  test('buildReadCursorDelta — coalesces many convs into one message', () => {
    const msg = buildReadCursorDelta({ [A]: '10', [B]: '20' }, 5)!;
    expect(Object.keys(msg.entries)).toEqual([A, B]);
    expect(msg.entries[A]!.lastReadNs).toBe('10');
    expect(msg.snapshot).toBeUndefined();
  });

  test('buildReadCursorDelta — empty input → null (nothing to send)', () => {
    expect(buildReadCursorDelta({})).toBeNull();
    expect(buildReadCursorDelta({ [A]: '' })).toBeNull();
  });

  test('buildSnapshot round-trips through fold', () => {
    const merged = foldChannelPrefs([
      { v: 1, entries: { [A]: { archived: true, ts: 10 } } },
      { v: 1, entries: { [B]: { pinned: true, ts: 20 } } },
    ]);
    const snap = buildSnapshot(merged, 999);
    expect(snap.snapshot).toBe(true);
    const refolded = foldChannelPrefs([snap]);
    expect(refolded.get(A)!.archived).toBe(true);
    expect(refolded.get(B)!.pinned).toBe(true);
  });
});

describe('toSnapshotEntries', () => {
  test('strips internal _ts and keeps the newest field ts as the entry ts', () => {
    const merged = foldChannelPrefs([
      { v: 1, entries: { [A]: { archived: true, ts: 10 } } },
      { v: 1, entries: { [A]: { pinned: true, ts: 30 } } },
    ]);
    const out = toSnapshotEntries(merged);
    expect(out[A]).toEqual({ ts: 30, archived: true, pinned: true });
  });
});
