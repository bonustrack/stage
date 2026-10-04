import { describe, expect, test } from 'bun:test';
import type { HistoryEntry } from '@stage-labs/client/types';
import {
  EMPTY_SNAPSHOT, INLINE_DATA_LIMIT, SNAPSHOT_LINES, decodeSnapshot, encodeSnapshot, lineEntries,
  snapshotEntries, withLine, withSelf,
} from '../lib/feedSnapshot.model';
import { entry } from './helpers';

const ids = (entries: readonly HistoryEntry[]): string[] => entries.map(e => e.id);
const messages = (n: number): HistoryEntry[] => Array.from({ length: n }, (_, i) => entry(`m${i}`));

describe('feed snapshot', () => {
  test('keeps the newest messages with their reactions and skips sends still in flight', () => {
    const slice = [
      entry('sending', { pending: true }),
      entry('r1', { payload: { reactTo: 'm0', emoji: '+1' } }),
      entry('m0'), entry('m1'),
      entry('r2', { payload: { reactTo: 'm2', emoji: '+1' } }),
      entry('m2'), entry('m3'),
    ];
    expect(ids(snapshotEntries(slice, 2))).toEqual(['r1', 'm0', 'm1', 'r2']);
    expect(snapshotEntries(messages(30))).toHaveLength(20);
  });

  test('drops inline file data that is too large to keep', () => {
    const big = 'A'.repeat(INLINE_DATA_LIMIT + 1);
    const withFile = entry('file', { payload: { attachments: [{ kind: 'file', name: 'a.bin', dataB64: big }, { kind: 'image', dataB64: 'AAAA' }] } });
    const [kept] = snapshotEntries([withFile]);
    expect(kept?.payload).toEqual({ attachments: [{ kind: 'file', name: 'a.bin', dataB64: undefined }, { kind: 'image', dataB64: 'AAAA' }] });
    const small = entry('small', { payload: { attachments: [{ kind: 'image', dataB64: 'AAAA' }] } });
    expect(snapshotEntries([small])[0]).toBe(small);
  });

  test('keeps the most recently written channels first and caps how many it keeps', () => {
    let snapshot = EMPTY_SNAPSHOT;
    for (let i = 0; i < SNAPSHOT_LINES + 5; i++) snapshot = withLine(snapshot, `line-${i}`, messages(1), i);
    expect(snapshot.lines).toHaveLength(SNAPSHOT_LINES);
    expect(snapshot.lines[0]?.line).toBe(`line-${SNAPSHOT_LINES + 4}`);
    expect(lineEntries(snapshot, 'line-0')).toBeNull();
    const reopened = withLine(snapshot, 'line-10', messages(2), 100);
    expect(reopened.lines[0]?.line).toBe('line-10');
    expect(lineEntries(reopened, 'line-10')).toHaveLength(2);
    expect(lineEntries(withLine(reopened, 'line-10', [], 101), 'line-10')).toBeNull();
  });

  test('round-trips file keys and big numbers', () => {
    const secret = new Uint8Array([1, 2, 3, 250]);
    const remote = entry('remote', { payload: { attachments: [{ kind: 'image', remote: { url: 'https://x', secret, contentLength: 12n } }] } });
    const snapshot = withSelf(withLine(EMPTY_SNAPSHOT, 'line-a', [remote], 5), 'inbox-a');
    const decoded = decodeSnapshot(encodeSnapshot(snapshot));
    expect(decoded?.self).toBe('inbox-a');
    const att = (lineEntries(decoded ?? EMPTY_SNAPSHOT, 'line-a')?.[0]?.payload as { attachments: { remote: { secret: Uint8Array; contentLength: bigint } }[] }).attachments[0];
    expect(att?.remote.secret).toEqual(secret);
    expect(att?.remote.contentLength).toBe(12n);
  });

  test('reads nothing from a damaged record', () => {
    expect(decodeSnapshot('not json')).toBeNull();
    expect(decodeSnapshot('{"self":null}')).toBeNull();
    const decoded = decodeSnapshot(JSON.stringify({ self: 7, lines: [{ line: 'a', at: 1, entries: [{ id: 'x' }] }, { line: 'b', at: 2, entries: [] }] }));
    expect(decoded).toEqual({ self: null, lines: [{ line: 'b', at: 2, entries: [] }] });
  });
});
