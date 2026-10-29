import { describe, expect, test } from 'bun:test';
import {
  collectSyncReplay,
  DEFAULT_DEVELOPER_MODE,
  mergeDeveloperMode,
  parseSyncState,
  type DeveloperModeContent,
  type SyncMessage,
} from '../src/xmtp/readState';
import { SYNC_CODECS } from '../src/xmtp/jsonCodecs';

const state = (enabled: boolean, at: number): DeveloperModeContent => ({ enabled, at });
const message = (content: unknown, sentNs: number, senderInboxId = 'self'): SyncMessage => ({
  content,
  sentNs,
  senderInboxId,
  contentTypeId: 'stage.box/developerMode:1.0',
});
const replay = (messages: SyncMessage[], afterNs = 0): DeveloperModeContent | null =>
  collectSyncReplay(messages, afterNs, { inboxId: 'self', nowMs: 100 }).latest.developerMode;

describe('developer mode sync', () => {
  test('defaults OFF and validates a complete, nonnegative clocked boolean', () => {
    expect(DEFAULT_DEVELOPER_MODE).toEqual(state(false, 0));
    for (const content of [state(false, 0), state(true, 12), state(false, 13)]) {
      expect(parseSyncState('developerMode', content)).toEqual(content);
    }
    for (const content of [true, {}, { enabled: 'true', at: 2 }, { at: 2 }, state(true, -1), state(true, NaN), state(true, Infinity)]) {
      expect(parseSyncState('developerMode', content)).toBeNull();
    }
  });

  test('serializes both ON and explicit OFF without push notifications', () => {
    for (const enabled of [false, true]) {
      const original = state(enabled, 12);
      expect(SYNC_CODECS.developerMode.decode(SYNC_CODECS.developerMode.encode(original))).toEqual(original);
    }
    expect(SYNC_CODECS.developerMode.shouldPush()).toBe(false);
  });

  test('newer payload clocks win regardless of arrival order', () => {
    const log = [message(state(true, 12), 4), message(state(false, 14), 2), message(state(true, 13), 5)];
    expect(replay(log)).toEqual(state(false, 14));
    expect(replay(log.toReversed())).toEqual(state(false, 14));
    expect(replay(log, 4)).toEqual(state(true, 13));
  });

  test('equal clocks deterministically resolve OFF in either replay order', () => {
    const on = state(true, 12);
    const off = state(false, 12);
    expect(mergeDeveloperMode(on, off)).toEqual(off);
    expect(mergeDeveloperMode(off, on)).toEqual(off);
    expect(replay([message(on, 1), message(off, 2)])).toEqual(off);
    expect(replay([message(off, 1), message(on, 2)])).toEqual(off);
    expect(mergeDeveloperMode(off, state(true, 13))).toEqual(state(true, 13));
  });

  test('rejects foreign, malformed, too-future and already-consumed messages', () => {
    const good = message(state(false, 12), 3);
    const log = [good, message(state(true, 20), 4, 'stranger'), message({ enabled: true }, 5), message(state(true, 86_400_101), 6)];
    expect(replay(log)).toEqual(good.content);
    expect(replay(log, 3)).toBeNull();
    expect(collectSyncReplay(log, 0, { inboxId: '', nowMs: 100 }).latest.developerMode).toBeNull();
  });

  test('two synthetic devices converge through the real codec and replay in both directions', () => {
    let phone = DEFAULT_DEVELOPER_MODE;
    let laptop = DEFAULT_DEVELOPER_MODE;
    const deliver = (current: DeveloperModeContent, sent: DeveloperModeContent): DeveloperModeContent => {
      const decoded = SYNC_CODECS.developerMode.decode(SYNC_CODECS.developerMode.encode(sent));
      const incoming = replay([message(decoded, 1)]);
      return incoming === null ? current : mergeDeveloperMode(current, incoming);
    };
    phone = state(true, 10);
    laptop = deliver(laptop, phone);
    expect(laptop).toEqual(phone);
    laptop = state(false, 11);
    phone = deliver(phone, laptop);
    expect(phone).toEqual(laptop);
    expect(deliver(phone, state(true, 10))).toEqual(phone);
    expect(deliver(phone, state(true, 11))).toEqual(phone);
  });
});
