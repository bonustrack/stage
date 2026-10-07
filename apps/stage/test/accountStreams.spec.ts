import { describe, expect, test } from 'bun:test';
import { openAccountStreams } from '../lib/xmtp.stream.core';

function fixture() {
  const controller = new AbortController();
  const state = { current: true, refreshes: 0, messageStops: 0, preferenceStops: 0, deletionStops: 0, deletions: 0 };
  let onChange = (): void => undefined;
  const deps = {
    signal: controller.signal,
    current: () => state.current,
    messages: async () => () => { state.messageStops += 1; },
    preferences: async (refresh: () => void) => {
      onChange = refresh;
      return () => { state.preferenceStops += 1; };
    },
    deletions: () => { state.deletions += 1; return () => { state.deletionStops += 1; }; },
    refreshPush: () => { state.refreshes += 1; },
  };
  return { deps, state, controller, emitPreference: () => { onChange(); } };
}

describe('account streams and sender-filter refreshes', () => {
  test('refreshes once after subscribing and on each inbox preference update', async () => {
    const f = fixture();
    const stop = await openAccountStreams(f.deps);
    expect(f.state.refreshes).toBe(1);
    f.emitPreference();
    expect(f.state.refreshes).toBe(2);
    f.state.current = false;
    stop();
    f.emitPreference();
    expect(f.state).toEqual({ current: false, refreshes: 2, messageStops: 1, preferenceStops: 1, deletionStops: 1, deletions: 1 });
  });

  test('refreshes after attaching even if a preference changed during SDK stream setup', async () => {
    const f = fixture();
    const preferences = f.deps.preferences;
    f.deps.preferences = async refresh => {
      refresh();
      return preferences(refresh);
    };
    const stop = await openAccountStreams(f.deps);
    expect(f.state.refreshes).toBe(2);
    f.state.current = false;
    stop();
  });

  test('stale account events never refresh the replacement account', async () => {
    const old = fixture();
    const stopOld = await openAccountStreams(old.deps);
    old.state.current = false;
    stopOld();
    const current = fixture();
    const stopCurrent = await openAccountStreams(current.deps);
    old.emitPreference();
    current.emitPreference();
    expect(old.state.refreshes).toBe(1);
    expect(current.state.refreshes).toBe(2);
    current.state.current = false;
    stopCurrent();
  });

  test('a switch during preference setup stops both handles without refreshing or opening deletions', async () => {
    const f = fixture();
    const preferences = f.deps.preferences;
    f.deps.preferences = async refresh => {
      f.state.current = false;
      return preferences(refresh);
    };
    const stop = await openAccountStreams(f.deps);
    stop();
    f.emitPreference();
    expect(f.state).toEqual({ current: false, refreshes: 0, messageStops: 1, preferenceStops: 1, deletionStops: 0, deletions: 0 });
  });

  test('account cancellation releases messages even when the preference worker never answers', async () => {
    const f = fixture();
    let attached = (): void => undefined;
    const started = new Promise<void>(resolve => { attached = resolve; });
    f.deps.preferences = () => { attached(); return new Promise(() => undefined); };
    const opening = openAccountStreams(f.deps);
    await started;
    f.state.current = false;
    f.controller.abort(new Error('account changed'));
    await expect(opening).rejects.toThrow('account changed');
    expect(f.state.messageStops).toBe(1);
    expect(f.state.refreshes).toBe(0);
  });

  test('a preference stream failure releases messages and propagates for global-stream retry', async () => {
    const f = fixture();
    f.deps.preferences = () => Promise.reject(new Error('stream offline'));
    await expect(openAccountStreams(f.deps)).rejects.toThrow('stream offline');
    expect(f.state.messageStops).toBe(1);
    expect(f.state.refreshes).toBe(0);
  });

  test('deletion setup failure also releases the preference handle', async () => {
    const f = fixture();
    f.deps.deletions = () => { throw new Error('deletion stream offline'); };
    await expect(openAccountStreams(f.deps)).rejects.toThrow('deletion stream offline');
    expect(f.state.messageStops).toBe(1);
    expect(f.state.preferenceStops).toBe(1);
  });
});
