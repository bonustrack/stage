import { afterEach, expect, test } from 'bun:test';
import {
  acquireCallAudio, acquireVoiceAudio, callOwnsAudio, registerCallRecorder, registerDictationRecorder,
  releaseCallAudio, releaseVoiceAudio, subscribeCallAudio, voiceOwnsAudio,
} from '../lib/calls.audio.core';

const voiceOwner = {};
afterEach(() => { releaseCallAudio(); releaseVoiceAudio(voiceOwner); });

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

test('voice reserves audio globally while every mounted dictation stops', async () => {
  const stopped = Promise.withResolvers<undefined>();
  const unregister = registerDictationRecorder(() => stopped.promise);
  let ready = false;
  try {
    const acquiring = acquireVoiceAudio(voiceOwner).then(() => { ready = true; });
    expect(voiceOwnsAudio()).toBe(true);
    await expect(acquireVoiceAudio({})).rejects.toThrow('other voice recording');
    releaseVoiceAudio({});
    expect(voiceOwnsAudio()).toBe(true);
    expect(ready).toBe(false);
    stopped.resolve(undefined);
    await acquiring;
    expect(ready).toBe(true);
    releaseVoiceAudio(voiceOwner);
    expect(voiceOwnsAudio()).toBe(false);
  } finally { await unregister(); }
});

test('failed dictation cleanup blocks voice and call audio acquisition', async () => {
  let failing = true;
  const unregister = registerDictationRecorder(async () => { if (failing) throw new Error('dictation cleanup failed'); });
  try {
    await expect(acquireVoiceAudio(voiceOwner)).rejects.toThrow('dictation cleanup failed');
    expect(voiceOwnsAudio()).toBe(false);
    await expect(acquireCallAudio()).rejects.toThrow('dictation cleanup failed');
  } finally { failing = false; await unregister(); }
});

test('call takeover during voice preparation prevents voice acquisition', async () => {
  const stopped = Promise.withResolvers<undefined>();
  const unregister = registerDictationRecorder(() => stopped.promise);
  try {
    const voice = acquireVoiceAudio(voiceOwner);
    const call = acquireCallAudio();
    stopped.resolve(undefined);
    await expect(voice).rejects.toThrow('Leave the call');
    await call;
    expect(voiceOwnsAudio()).toBe(false);
  } finally { await unregister(); }
});

test('unmount retains the dictation handoff barrier until native cleanup finishes', async () => {
  const stopped = Promise.withResolvers<undefined>();
  let stops = 0, ready = false;
  const unregister = registerDictationRecorder(async () => { stops += 1; await stopped.promise; });
  const unmounting = unregister();
  const acquiring = acquireCallAudio().then(() => { ready = true; });
  await Bun.sleep(1);
  expect(ready).toBe(false);
  expect(stops).toBe(2);
  stopped.resolve(undefined);
  await Promise.all([unmounting, acquiring]);
  expect(ready).toBe(true);
  await acquireCallAudio();
  expect(stops).toBe(2);
});

test('unmounted recorders are not stopped on call entry', async () => {
  let stops = 0;
  registerCallRecorder(async () => { stops += 1; })();
  await acquireCallAudio();
  expect(stops).toBe(0);
});
