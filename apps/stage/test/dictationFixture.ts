import { afterEach } from 'bun:test';
import { makeDictation } from '../components/composer/dictation.core';
import type { DictationDraft, DictationPhase } from '../components/composer/dictation.model';
import type { SpeechBridge, SpeechEvent } from '../lib/speech.types';

type Host = Parameters<typeof makeDictation>[1];

export function makeDictationHarness() {
  const cleanups: (() => Promise<void>)[] = [];
  afterEach(async () => { await Promise.all(cleanups.splice(0).map(cleanup => cleanup())); });
  return (bridge: Partial<SpeechBridge> = {}, host: Partial<Host> = {}, limitMs = 60_000) => {
    let draft: DictationDraft = { text: 'Hello there tomorrow', selection: { start: 6, end: 11 } };
    let listener: (event: SpeechEvent) => void = () => undefined;
    let blocked = false;
    const starts: string[] = [], stops: string[] = [], cancels: string[] = [];
    const phases: DictationPhase[] = [], errors: (string | null)[] = [];
    let permissions = 0, downloads = 0;
    const control = makeDictation({
      availability: async () => ({ available: true, download: false, locale: 'en-US' }),
      requestPermission: async () => { permissions += 1; return true; },
      downloadModel: async () => { downloads += 1; },
      start: async id => { starts.push(id); listener({ sessionId: id, state: 'listening' }); },
      stop: async id => { stops.push(id); },
      cancel: async id => { cancels.push(id); },
      subscribe: next => { listener = next; return () => undefined; },
      ...bridge,
    }, {
      read: () => draft,
      apply: next => { draft = next; },
      phase: next => { phases.push(next); },
      error: next => { errors.push(next); },
      microphoneGranted: async () => true,
      permission: async () => true,
      confirmDownload: async () => false,
      blocked: () => blocked,
      cleanupError: () => { errors.push('cleanup failed'); },
      ...host,
    }, limitMs, 30, 1);
    cleanups.push(control.dispose);
    return {
      control, starts, stops, cancels, phases, errors,
      draft: () => draft, permissions: () => permissions, downloads: () => downloads,
      event: (event: Omit<SpeechEvent, 'sessionId'>, id = starts.at(-1)) => {
        if (!id) throw new Error('No capture');
        listener({ sessionId: id, ...event });
      },
      block: () => { blocked = true; },
      edit: () => { draft = { text: 'My edit', selection: { start: 7, end: 7 } }; control.edited(); },
    };
  };
}

export const tick = async (): Promise<void> => { await Bun.sleep(15); };
