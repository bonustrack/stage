import { afterEach, describe, expect, it } from 'bun:test';
import { makeDictation } from '../components/composer/dictation.core';
import type { DictationPhase } from '../components/composer/dictation.model';
import type { SpeechBridge } from '../lib/speech.types';

type Host = Parameters<typeof makeDictation>[1];
const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => { await Promise.all(cleanups.splice(0).map(cleanup => cleanup())); });

function harness(host: Partial<Host> = {}, bridge: Partial<SpeechBridge> = {}) {
  const events: string[] = [];
  const phases: DictationPhase[] = [];
  const errors: (string | null)[] = [];
  let background = false;
  const control = makeDictation({
    availability: async () => ({ available: true, download: false, locale: 'en-US' }),
    requestPermission: async () => { events.push('speech-permission'); return true; },
    downloadModel: async () => undefined,
    start: async () => { events.push('start'); },
    stop: async () => { events.push('stop'); },
    cancel: async () => { events.push('cancel'); },
    subscribe: () => () => undefined,
    ...bridge,
  }, {
    read: () => ({ text: 'Kept', selection: { start: 4, end: 4 } }),
    apply: () => undefined,
    phase: value => { phases.push(value); },
    error: message => { errors.push(message); },
    microphoneGranted: async () => true,
    permission: async () => { events.push('mic-request'); return true; },
    confirmDownload: async () => false,
    blocked: () => background,
    cleanupError: () => { events.push('cleanup-error'); },
    ...host,
  });
  cleanups.push(control.dispose);
  return {
    control, events, phases, errors,
    background: () => { background = true; control.background(); },
    foreground: () => { background = false; },
  };
}

describe('dictation permission lifecycle', () => {
  it('checks an existing microphone grant without launching another permission activity', async () => {
    const h = harness();
    await h.control.start();
    expect(h.events).toEqual(['speech-permission', 'start']);
    expect(h.errors).toEqual([null]);
  });

  it('survives Android permission activity pause and resume before the grant resolves', async () => {
    const h = harness({
      microphoneGranted: async () => false,
      permission: async () => {
        h.background();
        await Promise.resolve();
        h.foreground();
        return true;
      },
    });
    await h.control.start();
    expect(h.events).toEqual(['speech-permission', 'start']);
    expect(h.phases).toEqual(['preparing']);
    expect(h.errors).toEqual([null]);
  });

  it('does not start if permission completes while the app remains in the background', async () => {
    const h = harness({
      microphoneGranted: async () => false,
      permission: async () => { h.background(); return true; },
    });
    await h.control.start();
    h.foreground();
    expect(h.events).toEqual([]);
    expect(h.phases).toEqual(['preparing', 'idle']);
  });

  it('still cancels backgrounding during the read-only permission check', async () => {
    const h = harness({ microphoneGranted: async () => { h.background(); return true; } });
    await h.control.start();
    h.foreground();
    expect(h.events).toEqual([]);
    expect(h.phases).toEqual(['preparing', 'idle']);
  });

  it('still cancels after permission completes and native startup has begun', async () => {
    const h = harness();
    await h.control.start();
    h.background();
    await h.control.cancel();
    expect(h.events).toEqual(['speech-permission', 'start', 'cancel']);
    expect(h.phases).toEqual(['preparing', 'idle']);
  });

  it('does not revive an explicitly cancelled session after the permission prompt', async () => {
    const h = harness({
      microphoneGranted: async () => false,
      permission: async () => { h.background(); await h.control.cancel(); h.foreground(); return true; },
    });
    await h.control.start();
    expect(h.events).toEqual([]);
    expect(h.phases).toEqual(['preparing', 'idle']);
  });

  it('keeps useful denial feedback after the permission activity resumes', async () => {
    const h = harness({
      microphoneGranted: async () => false,
      permission: async () => { h.background(); h.foreground(); return false; },
    });
    await h.control.start();
    expect(h.events).toEqual([]);
    expect(h.errors.at(-1)).toContain('Allow microphone and speech recognition');
  });

  it('also waits for a foreground speech permission response before starting', async () => {
    const h = harness({}, { requestPermission: async () => { h.background(); h.foreground(); return true; } });
    await h.control.start();
    expect(h.events).toEqual(['start']);
    expect(h.errors).toEqual([null]);
  });
});
