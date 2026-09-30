import { describe, expect, it } from 'bun:test';
import { makeVoiceRecorder } from '../components/composer/voice.core';
import { hasAudioSignal, voiceFileMeta } from '../components/composer/voice.model';

function deferred() {
  return Promise.withResolvers<undefined>();
}

function harness(overrides: Partial<Parameters<typeof makeVoiceRecorder>[0]> = {}) {
  const events: string[] = [];
  const errors: unknown[] = [];
  const files: string[] = [];
  const recorder = makeVoiceRecorder({
    prepare: async () => { events.push('prepare'); },
    record: () => { events.push('record'); },
    stop: async () => { events.push('stop'); },
    file: async () => ({ uri: 'blob:voice', mime: 'audio/webm', extension: 'webm' }),
    ...overrides,
  }, {
    begin: () => { events.push('begin'); },
    started: () => { events.push('started'); },
    stopped: () => { events.push('stopped'); },
    error: error => { errors.push(error); },
    upload: async file => { files.push(file.mime); },
  });
  return { recorder, events, errors, files };
}

describe('voice recording formats and signal', () => {
  it('keeps the actual browser container and codec metadata', () => {
    expect(voiceFileMeta('audio/webm;codecs=opus')).toEqual({ mime: 'audio/webm;codecs=opus', extension: 'webm' });
    expect(voiceFileMeta('audio/mp4')).toEqual({ mime: 'audio/mp4', extension: 'm4a' });
    expect(voiceFileMeta('audio/ogg;codecs=opus').extension).toBe('ogg');
    expect(() => voiceFileMeta('')).toThrow('unsupported');
  });

  it('rejects digital silence, but keeps quiet sound and sound in any channel', () => {
    expect(hasAudioSignal([])).toBe(false);
    expect(hasAudioSignal([new Float32Array(), new Float32Array([0, -0, 0])])).toBe(false);
    expect(hasAudioSignal([new Float32Array([0, 0.00000001])])).toBe(true);
    expect(hasAudioSignal([new Float32Array([0]), new Float32Array([-0.25])])).toBe(true);
  });
});

describe('voice recorder lifecycle', () => {
  it('records, stops and adds the actual audio format to the draft', async () => {
    const h = harness();
    await h.recorder.start();
    await h.recorder.stop();
    expect(h.events).toEqual(['begin', 'prepare', 'record', 'started', 'stopped', 'stop']);
    expect(h.files).toEqual(['audio/webm']);
    expect(h.errors).toEqual([]);
  });

  it('allows retry after microphone preparation fails', async () => {
    let attempts = 0;
    const error = new Error('No microphone');
    const h = harness({ prepare: async () => { if (++attempts === 1) throw error; } });
    await h.recorder.start();
    await h.recorder.start();
    await h.recorder.stop();
    expect(attempts).toBe(2);
    expect(h.errors).toEqual([error]);
    expect(h.files).toEqual(['audio/webm']);
  });

  it('does not overlap starts while permission is pending and honors release', async () => {
    const permission = deferred();
    const h = harness({ prepare: () => permission.promise });
    const starting = h.recorder.start();
    await h.recorder.stop();
    await h.recorder.start();
    expect(h.events).toEqual(['begin']);
    permission.resolve(undefined);
    await starting;
    expect(h.events).toEqual(['begin', 'record', 'stopped', 'stop']);
    expect(h.files).toEqual(['audio/webm']);
  });

  it('cancellation during permission cannot be overwritten by release', async () => {
    const permission = deferred();
    const h = harness({ prepare: () => permission.promise });
    const starting = h.recorder.start();
    await h.recorder.cancel();
    await h.recorder.stop();
    permission.resolve(undefined);
    await starting;
    expect(h.files).toEqual([]);
    expect(h.events).toContain('stop');
  });

  it('waits for stop before another recording and stops only once', async () => {
    const stopping = deferred();
    let stops = 0;
    const h = harness({ stop: async () => { stops++; await stopping.promise; } });
    await h.recorder.start();
    const first = h.recorder.stop();
    const second = h.recorder.stop();
    await h.recorder.start();
    expect(h.events.filter(event => event === 'begin')).toHaveLength(1);
    stopping.resolve(undefined);
    await Promise.all([first, second]);
    expect(stops).toBe(1);
    expect(h.files).toHaveLength(1);
    await h.recorder.start();
    expect(h.events.filter(event => event === 'begin')).toHaveLength(2);
    await h.recorder.cancel();
  });

  it('reports a silent file instead of adding it and allows another recording', async () => {
    const error = new Error('No microphone sound was recorded');
    const h = harness({ file: async () => { throw error; } });
    await h.recorder.start();
    await h.recorder.stop();
    expect(h.files).toEqual([]);
    expect(h.errors).toEqual([error]);
    await h.recorder.start();
    expect(h.events.filter(event => event === 'record')).toHaveLength(2);
    await h.recorder.cancel();
  });

  it('recovers after stop fails', async () => {
    let attempts = 0;
    const h = harness({ stop: async () => { if (++attempts === 1) throw new Error('Stop failed'); } });
    await h.recorder.start();
    await h.recorder.stop();
    await h.recorder.start();
    await h.recorder.stop();
    expect(h.errors).toHaveLength(1);
    expect(h.files).toHaveLength(1);
  });

  it('stops the microphone on unmount without adding a file', async () => {
    const h = harness();
    await h.recorder.start();
    await h.recorder.dispose();
    await h.recorder.start();
    expect(h.events.filter(event => event === 'record')).toHaveLength(1);
    expect(h.events.filter(event => event === 'stop')).toHaveLength(1);
    expect(h.files).toEqual([]);
  });

  it('releases the microphone if preparation completes after unmount', async () => {
    const permission = deferred();
    const h = harness({ prepare: () => permission.promise });
    const starting = h.recorder.start();
    await h.recorder.dispose();
    permission.resolve(undefined);
    await starting;
    expect(h.events).toEqual(['begin', 'record', 'stopped', 'stop']);
    expect(h.files).toEqual([]);
  });

  it('cancels an upload if unmounted while validating the audio', async () => {
    const validating = deferred();
    const h = harness({ file: async () => { await validating.promise; return { uri: 'blob:voice', mime: 'audio/webm', extension: 'webm' }; } });
    await h.recorder.start();
    const stopping = h.recorder.stop();
    await Promise.resolve(undefined);
    const disposing = h.recorder.dispose();
    validating.resolve(undefined);
    await Promise.all([stopping, disposing]);
    expect(h.files).toEqual([]);
  });

  it('cleans up a prepared microphone if starting fails', async () => {
    const h = harness({ record: () => { throw new Error('Start failed'); } });
    await h.recorder.start();
    expect(h.events).toEqual(['begin', 'prepare', 'stopped', 'stop']);
    expect(h.errors).toHaveLength(1);
    expect(h.files).toEqual([]);
  });
});
