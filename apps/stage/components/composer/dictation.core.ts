import type { SpeechBridge, SpeechEvent } from '../../lib/speech.types';
import { dictationDraft, type DictationDraft, type DictationPhase } from './dictation.model';

interface DictationHost {
  read(): DictationDraft;
  apply(draft: DictationDraft): void;
  phase(phase: DictationPhase): void;
  error(message: string | null): void;
  microphoneGranted(): Promise<boolean>;
  permission(): Promise<boolean>;
  confirmDownload(locale: string): Promise<boolean>;
  blocked(): boolean;
  cleanupError(error: unknown): void;
}

interface Session {
  id: string;
  draft: DictationDraft;
  text: string;
  phase: DictationPhase;
  timer?: ReturnType<typeof setTimeout>;
  starting?: Promise<void>;
  permissionPending?: boolean;
}

interface Runtime {
  bridge: SpeechBridge;
  host: DictationHost;
  current: Session | null;
  disposed: boolean;
  voiceStarting: boolean;
  cleanup: Promise<void>;
  pending: Set<Session>;
  limitMs: number;
  finishMs: number;
}

let nextSession = 0;

function phase(r: Runtime, s: Session, value: DictationPhase): void {
  if (r.current !== s) return;
  s.phase = value;
  r.host.phase(value);
}

function end(r: Runtime, s: Session): void {
  clearTimeout(s.timer);
  if (r.current !== s) return;
  r.current = null;
  if (!r.disposed) r.host.phase('idle');
}

function cleanup(r: Runtime): Promise<void> {
  const drain = async (): Promise<void> => {
    for (const s of r.pending) {
      const starting = s.starting;
      await r.bridge.cancel(s.id);
      if (starting) {
        await Promise.allSettled([starting]);
        await r.bridge.cancel(s.id);
      }
      r.pending.delete(s);
    }
  };
  r.cleanup = r.cleanup.then(drain, drain);
  void r.cleanup.catch((error: unknown) => { r.host.cleanupError(error); });
  return r.cleanup;
}

function cancel(r: Runtime): Promise<void> {
  const s = r.current;
  if (s) { end(r, s); r.pending.add(s); }
  return r.pending.size > 0 ? cleanup(r) : r.cleanup;
}

function valid(r: Runtime, s: Session): boolean {
  if (r.disposed || r.current !== s) return false;
  if (r.host.blocked() || r.host.read().text !== s.text) { void cancel(r); return false; }
  return true;
}

function failed(r: Runtime, s: Session, message: string): void {
  if (r.current !== s) return;
  r.host.error(message);
  void cancel(r);
}

async function stop(r: Runtime): Promise<void> {
  const s = r.current;
  if (!s || s.phase === 'finishing') return;
  if (s.phase !== 'listening') {
    try { await cancel(r); }
    catch { r.host.error('Could not release dictation audio. Try stopping again. Your draft was kept.'); }
    return;
  }
  phase(r, s, 'finishing');
  clearTimeout(s.timer);
  s.timer = setTimeout(() => { failed(r, s, 'Dictation stopped. Check the text before sending.'); }, r.finishMs);
  try { await r.bridge.stop(s.id); }
  catch { failed(r, s, 'Could not finish dictation. Your draft was kept.'); }
}

function update(r: Runtime, s: Session, event: SpeechEvent): void {
  if (event.text) {
    const draft = dictationDraft(s.draft, event.text);
    s.text = draft.text;
    r.host.apply(draft);
  }
  if (event.error) { failed(r, s, event.error); return; }
  if (event.state === 'ended') { void cancel(r); return; }
  if (event.state === 'listening' && s.phase === 'preparing') {
    phase(r, s, 'listening');
    clearTimeout(s.timer);
    s.timer = setTimeout(() => { void stop(r); }, r.limitMs);
  }
  if (event.state === 'finishing' && s.phase === 'listening') void stop(r);
}

async function ensureAvailable(r: Runtime, s: Session): Promise<boolean> {
  const status = await r.bridge.availability();
  if (!valid(r, s)) return false;
  if (status.available) return true;
  if (!status.download) throw new Error(status.reason ?? 'On-device dictation is not available for this device language. Use typing or + to record voice.');
  if (await r.host.confirmDownload(status.locale) && valid(r, s)) {
    phase(r, s, 'downloading');
    await r.bridge.downloadModel();
    if (valid(r, s)) r.host.error('Speech model requested. Tap the mic again when the download is ready.');
  }
  end(r, s);
  return false;
}

async function permission(r: Runtime, s: Session): Promise<boolean> {
  const granted = await r.host.microphoneGranted();
  if (!valid(r, s)) return false;
  s.permissionPending = true;
  try {
    const permitted = granted || await r.host.permission();
    if (!valid(r, s)) return false;
    if (!permitted || !await r.bridge.requestPermission()) throw new Error('Allow microphone and speech recognition access in Settings to use dictation.');
    return valid(r, s);
  } finally { s.permissionPending = false; }
}

async function prepare(r: Runtime, s: Session): Promise<boolean> {
  await cleanup(r);
  if (!valid(r, s) || !await ensureAvailable(r, s)) return false;
  return permission(r, s);
}

async function start(r: Runtime): Promise<void> {
  if (r.disposed || r.current) return;
  if (r.voiceStarting || r.host.blocked()) { r.host.error('Stop the call or voice recording before using dictation.'); return; }
  const draft = r.host.read();
  const s: Session = { id: `dictation-${Date.now()}-${++nextSession}`, draft, text: draft.text, phase: 'preparing' };
  r.current = s;
  r.host.error(null);
  phase(r, s, 'preparing');
  try {
    if (!await prepare(r, s) || !valid(r, s)) return;
    s.timer = setTimeout(() => { failed(r, s, 'Dictation did not start. Try again or use + to record voice.'); }, 10_000);
    s.starting = r.bridge.start(s.id);
    try { await s.starting; }
    finally { s.starting = undefined; }
  } catch (error) {
    failed(r, s, error instanceof Error ? error.message : 'Dictation is unavailable. Your draft was kept.');
  }
}

async function recordVoice(r: Runtime, action: () => Promise<void>): Promise<void> {
  if (r.disposed || r.voiceStarting) return;
  r.voiceStarting = true;
  try {
    await cancel(r);
    if (r.disposed) return;
    if (r.host.blocked()) { r.host.error('Stop the call or other voice recording before recording a voice message.'); return; }
    await action();
  } catch {
    r.host.error('Could not release dictation audio. Try again before recording voice. Your draft was kept.');
  } finally { r.voiceStarting = false; }
}

export function makeDictation(bridge: SpeechBridge, host: DictationHost, limitMs = 60_000, finishMs = 5000) {
  const r: Runtime = { bridge, host, current: null, disposed: false, voiceStarting: false, cleanup: Promise.resolve(), pending: new Set(), limitMs, finishMs };
  const unsubscribe = bridge.subscribe(event => {
    const s = r.current;
    if (s && event.sessionId === s.id && valid(r, s)) update(r, s, event);
  });
  return {
    start: () => start(r), stop: () => stop(r), cancel: () => cancel(r),
    toggle: () => r.current ? stop(r) : start(r),
    recordVoice: (action: () => Promise<void>) => recordVoice(r, action),
    background: () => { if (!r.current?.permissionPending) void cancel(r); },
    inactive: () => { if (r.current?.phase === 'listening' || r.current?.phase === 'finishing') void cancel(r); },
    edited: () => { if (r.current && host.read().text !== r.current.text) void cancel(r); },
    dispose: (): Promise<void> => {
      if (!r.disposed) { r.disposed = true; unsubscribe(); }
      return cancel(r);
    },
  };
}
