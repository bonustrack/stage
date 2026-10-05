import { describe, expect, test } from 'bun:test';
import { collectSyncReplay, mergeHiddenChannels, parseSyncState, type HiddenChannels, type SyncMessage } from '../src/xmtp/readState';
import { SYNC_CODECS } from '../src/xmtp/jsonCodecs';

function message(hidden: HiddenChannels, sentNs: number, senderInboxId = 'owner'): SyncMessage {
  return { contentTypeId: 'stage.box/clearState:1.0', content: { cleared: {}, hidden }, sentNs, senderInboxId };
}
const state = (hidden: boolean, at: number): HiddenChannels => ({ group: { hidden, at } });
const trust = { inboxId: 'owner', nowMs: 1000 };

describe('hidden channel sync', () => {
  test('the existing clear codec carries channel state without changing deleted DMs', () => {
    const content = { cleared: { peer: 10 }, hidden: state(true, 20) };
    expect(SYNC_CODECS.clear.decode(SYNC_CODECS.clear.encode(content))).toEqual(content);
    expect(parseSyncState('clear', { cleared: { peer: 10 } })).toEqual({ cleared: { peer: 10 } });
    expect(parseSyncState('clear', { cleared: { peer: 10 }, hidden: { group: 'bad' } })?.cleared).toEqual({ peer: 10 });
  });

  test('offline devices replay leave and restore in timestamp order, not arrival order', () => {
    const leave = message(state(true, 100), 1);
    const restore = message(state(false, 200), 2);
    expect(collectSyncReplay([restore, leave], 0, trust).hidden).toEqual(state(false, 200));
    expect(collectSyncReplay([leave], 0, trust).hidden).toEqual(state(true, 100));
    expect(collectSyncReplay([leave], 1, trust).hidden).toBeNull();
  });

  test('a stale archive or old client snapshot never clears a leave', () => {
    const oldClient = { ...message({}, 3), content: { cleared: { peer: 10 } } };
    const replay = collectSyncReplay([message(state(true, 100), 2), message(state(false, 50), 4), oldClient], 0, trust);
    expect(replay.hidden).toEqual(state(true, 100));
    expect(replay.cleared).toEqual({ peer: 10 });
  });

  test('legacy backfill cannot overwrite an explicit approval', () => {
    expect(mergeHiddenChannels(state(false, 10), state(true, 0))).toEqual(state(false, 10));
  });

  test('concurrent timestamps converge to hidden in either order', () => {
    const hidden = state(true, 10);
    const shown = state(false, 10);
    expect(mergeHiddenChannels(hidden, shown)).toEqual(hidden);
    expect(mergeHiddenChannels(shown, hidden)).toEqual(hidden);
  });

  test('other senders and far future state are ignored', () => {
    const replay = collectSyncReplay([
      message(state(true, 20), 1, 'other-owner'),
      message(state(true, trust.nowMs + 86_400_001), 2),
    ], 0, trust);
    expect(replay.hidden).toEqual({});
    expect(collectSyncReplay([message(state(true, 20), 1)], 0, { ...trust, inboxId: '' }).hidden).toBeNull();
  });
});
