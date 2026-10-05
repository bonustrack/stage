import { describe, expect, test } from 'bun:test';
import type { HistoryEntry } from '@stage-labs/client/types';
import { makeLocalAttachmentCache } from '../lib/localAttachmentCache.core';
import type { UploadedAttachment } from '../lib/xmtp.types';
import {
  outboundView, recordSent, settleOutbound, type OutboundState,
} from '../components/conversation/outboundRows.model';

const ME = 'metro://xmtp/me';
const REMOTE = { url: 'https://store.example/encrypted-1', contentDigest: 'digest-1' };
const OTHER = { url: 'https://store.example/encrypted-2', contentDigest: 'digest-2' };
const URI = 'file:///photo.jpg';

function entry(id: string, attachments: object[], extra: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    id, station: 'xmtp', line: 'line', from: ME, to: 'line', ts: '2026-10-05T10:00:00.000Z',
    payload: { attachments }, ...extra,
  };
}

const photo = (id = 'tmp_1') => entry(id, [{ id: 'photo', url: URI, kind: 'image', mime: 'image/jpeg', name: 'photo.jpg' }]);
const echo = (id = 'real_1', remotes = [REMOTE], extra: Partial<HistoryEntry> = {}) =>
  entry(id, remotes.map(remote => ({ kind: 'image', name: 'photo.jpg', remote })), extra);
const pending = (...optimistic: HistoryEntry[]): OutboundState => ({ optimistic, confirmedIds: new Map() });

function harness(state = pending(photo())) {
  const cache = makeLocalAttachmentCache();
  const view = (live: HistoryEntry[] = []) => outboundView(state, live, ME, cache.uploaded());
  return {
    cache, view,
    keys(live: HistoryEntry[] = []) {
      const result = view(live);
      return [...result.pending, ...live].map(e => result.localIdOf.get(e.id) ?? e.id);
    },
    sent(localId: string, sentId?: string) { state = recordSent(state, localId, sentId); },
    settle(live: HistoryEntry[]) { state = settleOutbound(state, view(live).confirmed); },
    retry(localId: string) { state = { ...state, optimistic: [...state.optimistic, photo(localId)] }; },
  };
}

describe('one bubble per outgoing attachment message', () => {
  test('the upload, early echo, send result and cleanup keep one stable row and local preview', () => {
    const h = harness();
    expect(h.keys()).toEqual(['tmp_1']);
    h.cache.remember('tmp_1', [URI], [REMOTE]);
    expect(h.keys()).toEqual(['tmp_1']);
    const live = [echo()];
    expect(h.keys(live)).toEqual(['tmp_1']);
    expect(h.view(live).pending).toEqual([]);
    expect(h.cache.get('real_1', 0, REMOTE)).toBe(URI);
    h.settle(live);
    expect(h.keys(live)).toEqual(['tmp_1']);
    h.sent('tmp_1', 'real_1');
    h.cache.remember('real_1', [URI]);
    expect(h.keys(live)).toEqual(['tmp_1']);
    expect(h.cache.get('real_1', 0, REMOTE)).toBe(URI);
  });

  test('a send result before its echo does not remove or duplicate the pending row', () => {
    const h = harness();
    h.cache.remember('tmp_1', [URI], [REMOTE]);
    h.sent('tmp_1', 'real_1');
    expect(h.keys()).toEqual(['tmp_1']);
    expect(h.keys([echo()])).toEqual(['tmp_1']);
    h.settle([echo()]);
    expect(h.keys([echo()])).toEqual(['tmp_1']);
  });

  test('a slow upload and an echo predating new-chat handoff still match exactly', () => {
    const h = harness();
    h.cache.remember('tmp_1', [URI], [REMOTE]);
    expect(h.keys([echo('slow', [REMOTE], { ts: '2026-10-05T10:02:00.000Z' })])).toEqual(['tmp_1']);
    expect(h.keys([echo('handoff', [REMOTE], { ts: '2026-10-05T09:59:50.000Z' })])).toEqual(['tmp_1']);
  });

  test('matching filenames or timestamps never hide a different image or sender', () => {
    const h = harness();
    h.cache.remember('tmp_1', [URI], [REMOTE]);
    const unrelated = [
      echo('different-upload', [OTHER]),
      echo('different-sender', [REMOTE], { from: 'metro://xmtp/other' }),
      echo('different-line', [REMOTE], { line: 'other-line' }),
      echo('different-digest', [{ ...REMOTE, contentDigest: 'other' }]),
    ];
    for (const row of unrelated) expect(h.keys([row])).toEqual(['tmp_1', row.id]);
  });

  test('two pending images with the same name pair with their own echoes out of order', () => {
    const h = harness(pending(photo('tmp_1'), photo('tmp_2')));
    h.cache.remember('tmp_1', [URI], [REMOTE]);
    h.cache.remember('tmp_2', ['file:///second/photo.jpg'], [OTHER]);
    expect(h.keys([echo('real_2', [OTHER])])).toEqual(['tmp_1', 'tmp_2']);
    const live = [echo('real_2', [OTHER]), echo()];
    expect(h.keys(live)).toEqual(['tmp_2', 'tmp_1']);
    h.settle(live);
    expect(h.keys(live)).toEqual(['tmp_2', 'tmp_1']);
    expect(h.cache.get('real_2', 0, OTHER)).toBe('file:///second/photo.jpg');
  });

  test('one echo cannot confirm two pending messages using the same uploaded file', () => {
    const h = harness(pending(photo('tmp_1'), photo('tmp_2')));
    h.cache.remember('tmp_1', [URI], [REMOTE]);
    h.cache.remember('tmp_2', [URI], [REMOTE]);
    const live = [echo()];
    expect(h.view(live).confirmed.size).toBe(1);
    h.settle(live);
    expect(h.keys(live).sort()).toEqual(['tmp_1', 'tmp_2']);
    expect(h.view(live).confirmed.size).toBe(0);
    expect(h.keys([...live, echo('real_2')]).sort()).toEqual(['tmp_1', 'tmp_2']);
  });

  test('a known send id takes precedence over another message with the same attachment', () => {
    const h = harness();
    h.cache.remember('tmp_1', [URI], [REMOTE]);
    h.sent('tmp_1', 'real_1');
    expect(h.keys([echo('other-id')])).toEqual(['tmp_1', 'other-id']);
    expect(h.keys([echo('other-id'), echo()])).toEqual(['other-id', 'tmp_1']);
  });

  test('an attachment batch matches the entire ordered upload, not a subset', () => {
    const h = harness(pending(entry('tmp_1', [{ url: URI }, { url: 'file:///second.jpg' }])));
    h.cache.remember('tmp_1', [URI, 'file:///second.jpg'], [REMOTE, OTHER]);
    expect(h.keys([echo()])).toEqual(['tmp_1', 'real_1']);
    expect(h.keys([echo('reversed', [OTHER, REMOTE])])).toEqual(['tmp_1', 'reversed']);
    expect(h.keys([echo('batch', [REMOTE, OTHER])])).toEqual(['tmp_1']);
    expect(h.cache.get('batch', 1, OTHER)).toBe('file:///second.jpg');
  });

  test('failed upload removal and retry leave just the retry bubble', () => {
    const h = harness();
    h.sent('tmp_1');
    expect(h.keys()).toEqual([]);
    h.retry('tmp_2');
    expect(h.keys()).toEqual(['tmp_2']);
    h.cache.remember('tmp_2', [URI], [OTHER]);
    expect(h.keys([echo('real_2', [OTHER])])).toEqual(['tmp_2']);
  });

  test('a send failure after its echo was reconciled cannot remove the delivered image', () => {
    const h = harness();
    h.cache.remember('tmp_1', [URI], [REMOTE]);
    const live = [echo()];
    h.settle(live);
    h.sent('tmp_1');
    expect(h.keys(live)).toEqual(['tmp_1']);
    expect(h.cache.get('real_1', 0, REMOTE)).toBe(URI);
  });
});

describe('local attachment previews', () => {
  test('uploaded keys are immutable snapshots and metadata-free previews still work', () => {
    const cache = makeLocalAttachmentCache();
    const empty = cache.uploaded();
    expect(cache.remember('tmp_1', [URI], [REMOTE])).toBe(true);
    const uploaded = cache.uploaded();
    expect(empty.size).toBe(0);
    expect(uploaded.size).toBe(1);
    cache.remember('real_1', [URI]);
    expect(cache.uploaded()).toBe(uploaded);
    expect(cache.get('real_1', 0)).toBe(URI);
    expect(cache.get('unknown', 0, OTHER)).toBeUndefined();
    expect(cache.remember('empty', [undefined], [OTHER])).toBe(false);
    expect(cache.uploaded()).toBe(uploaded);
  });

  test('remote URL alone is not enough to reuse local content', () => {
    const cache = makeLocalAttachmentCache();
    cache.remember('tmp_1', [URI], [REMOTE]);
    const altered: UploadedAttachment = { ...REMOTE, contentDigest: 'different' };
    expect(cache.get('real_1', 0, altered)).toBeUndefined();
  });
});
