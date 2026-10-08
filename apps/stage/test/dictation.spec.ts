import { afterEach, describe, expect, it } from 'bun:test';
import { makeDictation } from '../components/composer/dictation.core';
import { dictationDraft, dictationLabel, type DictationDraft, type DictationPhase } from '../components/composer/dictation.model';
import { unavailableSpeech } from '../lib/speech.unavailable';
import type { SpeechBridge, SpeechEvent } from '../lib/speech.types';

type Host = Parameters<typeof makeDictation>[1];
const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => { await Promise.all(cleanups.splice(0).map(cleanup => cleanup())); });

function harness(overrides: Partial<SpeechBridge> = {}, callbacks: Partial<Host> = {}, timers?: [number, number]) {
  const events: string[] = [];
  const errors: (string | null)[] = [];
  const phases: DictationPhase[] = [];
  let draft: DictationDraft = { text: 'Hello ', selection: { start: 6, end: 6 } };
  let listener: (event: SpeechEvent) => void = () => undefined;
  let id = '';
  const bridge: SpeechBridge = {
    availability: async () => ({ available: true, download: false, locale: 'en-US' }),
    requestPermission: async () => { events.push('speech-permission'); return true; },
    downloadModel: async () => { events.push('download'); },
    start: async value => { id = value; events.push('start'); listener({ sessionId: id, state: 'listening' }); },
    stop: async () => { events.push('stop'); },
    cancel: async value => { events.push(`cancel:${value}`); },
    subscribe: next => { listener = next; return () => { events.push('unsubscribe'); }; },
    ...overrides,
  };
  const control = makeDictation(bridge, {
    read: () => draft,
    apply: next => { draft = next; },
    phase: value => { phases.push(value); },
    error: message => { errors.push(message); },
    microphoneGranted: async () => false,
    permission: async () => { events.push('mic-permission'); return true; },
    confirmDownload: async locale => { events.push(`confirm:${locale}`); return true; },
    blocked: () => false,
    cleanupError: () => { events.push('cleanup-error'); },
    ...callbacks,
  }, ...(timers ?? []));
  cleanups.push(control.dispose);
  return {
    control, events, errors, phases,
    draft: () => draft,
    edit: (text: string) => { draft = { text, selection: { start: text.length, end: text.length } }; control.edited(); },
    event: (event: Omit<SpeechEvent, 'sessionId'>, sessionId = id) => { listener({ sessionId, ...event }); },
    id: () => id,
  };
}

describe('dictation draft insertion', () => {
  it('inserts at the selection while preserving existing text', () => {
    expect(dictationDraft({ text: 'Meet here tomorrow', selection: { start: 5, end: 9 } }, 'there')).toEqual({
      text: 'Meet there tomorrow', selection: { start: 10, end: 10 },
    });
    expect(dictationDraft({ text: 'Hello!', selection: { start: 5, end: 5 } }, 'world').text).toBe('Hello world!');
    expect(dictationDraft({ text: 'Hello', selection: { start: 5, end: 5 } }, '.').text).toBe('Hello.');
  });

  it('keeps empty recognition and clamps stale cursor positions', () => {
    const draft = { text: 'Kept', selection: { start: 0, end: 4 } };
    expect(dictationDraft(draft, '')).toEqual(draft);
    expect(dictationDraft({ text: 'Text', selection: { start: 40, end: 99 } }, 'more').text).toBe('Text more');
  });

  it('shows distinct private listening, preparation and completion states', () => {
    expect(dictationLabel('listening')).toContain('on device');
    expect(dictationLabel('preparing')).toContain('Preparing');
    expect(dictationLabel('downloading')).toContain('Downloading');
    expect(dictationLabel('finishing')).toContain('Finishing');
    expect(dictationLabel('idle')).toBe('');
  });
});

describe('dictation speech bridge', () => {
  it('replaces provisional results and leaves final text unsent in the editable draft', async () => {
    const h = harness();
    await h.control.start();
    h.event({ text: 'wor' });
    expect(h.draft().text).toBe('Hello wor');
    h.event({ text: 'world' });
    await h.control.stop();
    expect(h.phases.at(-1)).toBe('finishing');
    h.event({ text: 'world.', state: 'ended' });
    expect(h.draft().text).toBe('Hello world.');
    expect(h.phases).toEqual(['preparing', 'listening', 'finishing', 'idle']);
    expect(h.events).toEqual(['mic-permission', 'speech-permission', 'start', 'stop']);
  });

  it('keeps partial text when final results are empty or absent', async () => {
    const h = harness();
    await h.control.start();
    h.event({ text: 'world' });
    h.event({ text: '', state: 'ended' });
    expect(h.draft().text).toBe('Hello world');
    expect(h.phases.at(-1)).toBe('idle');
  });

  it('manual editing immediately cancels and rejects later corrections', async () => {
    const h = harness();
    await h.control.start();
    h.event({ text: 'world' });
    h.edit('Hello everyone');
    h.event({ text: 'world!', state: 'ended' });
    await h.control.cancel();
    expect(h.draft().text).toBe('Hello everyone');
    expect(h.events.filter(event => event.startsWith('cancel:'))).toHaveLength(1);
  });

  it('ignores stale events from previous sessions', async () => {
    const h = harness();
    await h.control.start();
    const old = h.id();
    await h.control.cancel();
    await h.control.start();
    h.event({ text: 'wrong', state: 'ended' }, old);
    expect(h.draft().text).toBe('Hello ');
    expect(h.phases.at(-1)).toBe('listening');
    h.event({ text: 'new', state: 'ended' });
    expect(h.draft().text).toBe('Hello new');
  });

  it('allows a final-only recognizer without requiring partial events', async () => {
    const h = harness();
    await h.control.start();
    h.event({ text: 'one final result', state: 'ended' });
    expect(h.draft().text).toBe('Hello one final result');
  });

  it('does not overlap starts and cancels pending microphone permission on leaving', async () => {
    const permission = Promise.withResolvers<boolean>();
    const entered = Promise.withResolvers<undefined>();
    const h = harness({}, { permission: () => { entered.resolve(undefined); return permission.promise; } });
    const starting = h.control.start();
    await entered.promise;
    await h.control.start();
    await h.control.dispose();
    permission.resolve(true);
    await starting;
    expect(h.events).not.toContain('start');
    expect(h.phases.filter(value => value === 'preparing')).toHaveLength(1);
  });

  it('does not start after a permission grant races call takeover', async () => {
    const permission = Promise.withResolvers<boolean>();
    const entered = Promise.withResolvers<undefined>();
    let blocked = false;
    const h = harness({}, { permission: () => { entered.resolve(undefined); return permission.promise; }, blocked: () => blocked });
    const starting = h.control.start();
    await entered.promise;
    blocked = true;
    permission.resolve(true);
    await starting;
    expect(h.events).not.toContain('start');
    expect(h.draft().text).toBe('Hello ');
  });

  it('does not request the microphone while another capture owns audio', async () => {
    const h = harness({}, { blocked: () => true });
    await h.control.start();
    expect(h.events).toEqual([]);
    expect(h.errors.at(-1)).toContain('Stop the call or voice recording');
  });

  it('refuses denied microphone and speech permissions without recording', async () => {
    const mic = harness({}, { permission: async () => false });
    const speech = harness({ requestPermission: async () => false });
    await mic.control.start();
    await speech.control.start();
    expect(mic.events).not.toContain('start');
    expect(speech.events).not.toContain('start');
    expect(mic.errors.at(-1)).toContain('Settings');
    expect(speech.errors.at(-1)).toContain('Settings');
  });

  it('reports unsupported devices and old installed binaries without any capture fallback', async () => {
    const h = harness(unavailableSpeech);
    await h.control.start();
    expect(h.errors.at(-1)).toContain('newer Stage app');
    expect(h.events).toEqual([]);
    expect(h.draft().text).toBe('Hello ');
  });

  it('asks before downloading and does not mistake a scheduled model for readiness', async () => {
    const h = harness({ availability: async () => ({ available: false, download: true, locale: 'fr-FR' }) });
    await h.control.start();
    expect(h.events).toEqual(['confirm:fr-FR', 'download']);
    expect(h.errors.at(-1)).toContain('Tap the mic again');
    expect(h.phases).toEqual(['preparing', 'downloading', 'idle']);
  });

  it('does not download when declined or after the composer has gone away', async () => {
    const availability = async () => ({ available: false, download: true, locale: 'en-US' });
    const declined = harness({ availability }, { confirmDownload: async () => false });
    await declined.control.start();
    expect(declined.events).not.toContain('download');
    const answer = Promise.withResolvers<boolean>();
    const entered = Promise.withResolvers<undefined>();
    const gone = harness({ availability }, { confirmDownload: () => { entered.resolve(undefined); return answer.promise; } });
    const starting = gone.control.start();
    await entered.promise;
    await gone.control.dispose();
    answer.resolve(true);
    await starting;
    expect(gone.events).not.toContain('download');
    expect(gone.events).not.toContain('start');
  });

  it('waits for endpoint finals without stopping native twice', async () => {
    const h = harness();
    await h.control.start();
    h.event({ state: 'finishing' });
    h.event({ state: 'finishing' });
    await h.control.stop();
    expect(h.events.filter(event => event === 'stop')).toHaveLength(0);
    h.event({ text: 'final', state: 'ended' });
    expect(h.draft().text).toBe('Hello final');
  });

  it('preserves recognized text on service failures and permits retry', async () => {
    const h = harness();
    await h.control.start();
    h.event({ text: 'draft' });
    h.event({ error: 'Language model unavailable', state: 'ended' });
    await h.control.start();
    expect(h.errors).toContain('Language model unavailable');
    expect(h.draft().text).toBe('Hello draft');
    expect(h.events.filter(event => event === 'start')).toHaveLength(2);
  });

  it('bounds listening and finalization even when the recognizer never ends', async () => {
    const h = harness({}, {}, [5, 5]);
    await h.control.start();
    h.event({ text: 'kept' });
    await Bun.sleep(40);
    expect(h.events).toContain('stop');
    expect(h.events.some(event => event.startsWith('cancel:'))).toBe(true);
    expect(h.phases.at(-1)).toBe('idle');
    expect(h.draft().text).toBe('Hello kept');
  });

  it('honors cancellation while the native speech authorization dialog is open', async () => {
    const permission = Promise.withResolvers<boolean>();
    const entered = Promise.withResolvers<undefined>();
    const h = harness({ requestPermission: () => { entered.resolve(undefined); return permission.promise; } });
    const starting = h.control.start();
    await entered.promise;
    await h.control.cancel();
    permission.resolve(true);
    await starting;
    expect(h.events).not.toContain('start');
  });

  it('waits for native cleanup before starting another session', async () => {
    const cleaned = Promise.withResolvers<undefined>();
    const h = harness({ cancel: () => cleaned.promise });
    await h.control.start();
    const cancelling = h.control.cancel();
    const starting = h.control.start();
    await Bun.sleep(1);
    expect(h.events.filter(event => event === 'start')).toHaveLength(1);
    cleaned.resolve(undefined);
    await cancelling;
    await starting;
    expect(h.events.filter(event => event === 'start')).toHaveLength(2);
  });

  it('hands audio to voice recording without allowing dictation during voice preparation', async () => {
    const preparing = Promise.withResolvers<undefined>();
    const entered = Promise.withResolvers<undefined>();
    const h = harness();
    await h.control.start();
    h.event({ text: 'kept' });
    const recording = h.control.recordVoice(() => {
      expect(h.events.some(event => event.startsWith('cancel:'))).toBe(true);
      entered.resolve(undefined);
      return preparing.promise;
    });
    await entered.promise;
    await h.control.start();
    expect(h.events.filter(event => event === 'start')).toHaveLength(1);
    expect(h.draft().text).toBe('Hello kept');
    preparing.resolve(undefined);
    await recording;
    await h.control.start();
    expect(h.events.filter(event => event === 'start')).toHaveLength(2);
  });

  it('rejects failed cleanup and blocks voice handoff until a successful retry', async () => {
    let failing = true, recorded = false;
    const h = harness({ cancel: async () => { if (failing) throw new Error('restore failed'); } });
    await h.control.start();
    h.event({ text: 'kept' });
    await expect(h.control.cancel()).rejects.toThrow('restore failed');
    await h.control.recordVoice(async () => { recorded = true; });
    expect(recorded).toBe(false);
    expect(h.errors.at(-1)).toContain('Could not release dictation audio');
    expect(h.events).toContain('cleanup-error');
    expect(h.draft().text).toBe('Hello kept');
    failing = false;
    await h.control.recordVoice(async () => { recorded = true; });
    expect(recorded).toBe(true);
  });

  it('drains late native startup and cancels it again before handing off audio', async () => {
    const entered = Promise.withResolvers<undefined>();
    const started = Promise.withResolvers<undefined>();
    let recorded = false;
    const h = harness({ start: async () => { entered.resolve(undefined); await started.promise; } });
    const starting = h.control.start();
    await entered.promise;
    const handoff = h.control.recordVoice(async () => { recorded = true; });
    await Bun.sleep(1);
    expect(recorded).toBe(false);
    expect(h.events.filter(event => event.startsWith('cancel:'))).toHaveLength(1);
    started.resolve(undefined);
    await Promise.all([starting, handoff]);
    expect(h.events.filter(event => event.startsWith('cancel:'))).toHaveLength(2);
    expect(recorded).toBe(true);
  });

  it('keeps startup errors delivered with a terminal native event', async () => {
    const entered = Promise.withResolvers<undefined>();
    const started = Promise.withResolvers<undefined>();
    let id = '';
    const h = harness({ start: async value => { id = value; entered.resolve(undefined); await started.promise; throw new Error('start rejected'); } });
    const starting = h.control.start();
    await entered.promise;
    h.event({ error: 'Microphone activation failed', state: 'ended' }, id);
    started.resolve(undefined);
    await starting;
    expect(h.errors.at(-1)).toBe('Microphone activation failed');
    expect(h.phases.at(-1)).toBe('idle');
  });

  it('stops inactive listening but does not cancel its own permission prompt', async () => {
    const permission = Promise.withResolvers<boolean>();
    const entered = Promise.withResolvers<undefined>();
    const h = harness({}, { permission: () => { entered.resolve(undefined); return permission.promise; } });
    const starting = h.control.start();
    await entered.promise;
    h.control.inactive();
    permission.resolve(true);
    await starting;
    expect(h.phases.at(-1)).toBe('listening');
    h.event({ text: 'kept' });
    h.control.inactive();
    h.event({ text: 'late' });
    await h.control.cancel();
    expect(h.phases.at(-1)).toBe('idle');
    expect(h.draft().text).toBe('Hello kept');
  });

  it('explains blocked voice recording instead of silently ignoring the action', async () => {
    const h = harness({}, { blocked: () => true });
    let recorded = false;
    await h.control.recordVoice(async () => { recorded = true; });
    expect(recorded).toBe(false);
    expect(h.errors.at(-1)).toContain('Stop the call');
  });

  it('keeps text if native stop fails', async () => {
    const h = harness({ stop: async () => { throw new Error('failed'); } });
    await h.control.start();
    h.event({ text: 'kept' });
    await h.control.stop();
    expect(h.draft().text).toBe('Hello kept');
    expect(h.errors.at(-1)).toContain('Your draft was kept');
  });
});
