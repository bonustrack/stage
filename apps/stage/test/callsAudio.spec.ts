import { afterEach, expect, test } from 'bun:test';
import { acquireCallAudio, callOwnsAudio, registerCallRecorder, releaseCallAudio, subscribeCallAudio } from '../lib/calls.audio.core';

afterEach(releaseCallAudio);

test('native call owns audio before waiting for a recorder to stop', async () => {
  let finish: () => void = () => undefined;
  const stopped = new Promise<void>(resolve => { finish = resolve; });
  const unregister = registerCallRecorder(() => stopped);
  const changes: boolean[] = [];
  const unsubscribe = subscribeCallAudio(() => { changes.push(callOwnsAudio()); });
  try {
    const acquiring = acquireCallAudio();
    expect(callOwnsAudio()).toBe(true);
    finish();
    await acquiring;
    releaseCallAudio();
    expect(changes).toEqual([true, false]);
  } finally { unregister(); unsubscribe(); }
});

test('failed recorder cleanup is not treated as audio ready', async () => {
  const unregister = registerCallRecorder(() => Promise.reject(new Error('Cannot stop recorder')));
  try { await expect(acquireCallAudio()).rejects.toThrow('Cannot stop recorder'); }
  finally { unregister(); }
});

test('unmounted recorders are not stopped on call entry', async () => {
  let stops = 0;
  registerCallRecorder(async () => { stops += 1; })();
  await acquireCallAudio();
  expect(stops).toBe(0);
});
