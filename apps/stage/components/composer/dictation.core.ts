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

interface Capture {
  id: string;
  draft: DictationDraft;
  state: 'starting' | 'listening' | 'finishing';
  startedAt: number;
  heard: boolean;
  starting?: Promise<void>;
}

interface Session {
  draft: DictationDraft;
  text: string;
  phase: DictationPhase;
  capture: Capture | null;
  stopping: boolean;
  rapidEnds: number;
  languageFallback?: boolean;
  lastCaptureId?: string;
  timer?: ReturnType<typeof setTimeout>;
  permissionPending?: boolean;
}

interface Runtime {
  bridge: SpeechBridge;
  host: DictationHost;
  current: Session | null;
  disposed: boolean;
  voiceStarting: boolean;
  cleanup: Promise<void>;
  pending: Set<Capture>;
  limitMs: number;
  finishMs: number;
  restartMs: number;
}

let nextCapture = 0;
const restartingReasons = new Set<SpeechEvent['reason']>(['segment', 'silence', 'fallback']);

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
    for (const capture of r.pending) {
      const starting = capture.starting;
      await r.bridge.cancel(capture.id);
      if (starting) {
        await Promise.allSettled([starting]);
        await r.bridge.cancel(capture.id);
      }
      r.pending.delete(capture);
    }
  };
  r.cleanup = r.cleanup.then(drain, drain);
  void r.cleanup.catch((error: unknown) => { r.host.cleanupError(error); });
  return r.cleanup;
}

function cancel(r: Runtime): Promise<void> {
  const s = r.current;
  if (s) {
    end(r, s);
    if (s.capture) r.pending.add(s.capture);
  }
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

async function finishCapture(r: Runtime, s: Session, request: boolean): Promise<void> {
  const capture = s.capture;
  if (!capture || capture.state === 'finishing') return;
  capture.state = 'finishing';
  clearTimeout(s.timer);
  phase(r, s, s.stopping ? 'finishing' : 'restarting');
  s.timer = setTimeout(() => { failed(r, s, 'Dictation stopped. Check the text before sending.'); }, r.finishMs);
  if (!request) return;
  try { await r.bridge.stop(capture.id); }
  catch { failed(r, s, 'Could not finish dictation. Your draft was kept.'); }
}

async function stop(r: Runtime): Promise<void> {
  const s = r.current;
  if (!s || s.stopping) return;
  s.stopping = true;
  if (!s.capture || s.capture.state === 'starting') {
    try { await cancel(r); }
    catch { r.host.error('Could not release dictation audio. Try stopping again. Your draft was kept.'); }
    return;
  }
  if (s.capture.state === 'finishing') phase(r, s, 'finishing');
  else await finishCapture(r, s, true);
}

async function startCapture(r: Runtime, s: Session): Promise<void> {
  try {
    await cleanup(r);
    if (!valid(r, s) || s.stopping) return;
    const capture: Capture = {
      id: `dictation-${Date.now()}-${++nextCapture}`, draft: s.draft,
      state: 'starting', startedAt: Date.now(), heard: false,
    };
    s.capture = capture;
    s.lastCaptureId = capture.id;
    s.timer = setTimeout(() => { failed(r, s, 'Dictation did not start. Try again or use + to record voice.'); }, 10_000);
    capture.starting = r.bridge.start(capture.id);
    try { await capture.starting; }
    finally { capture.starting = undefined; }
  } catch (error) {
    failed(r, s, error instanceof Error ? error.message : 'Dictation is unavailable. Your draft was kept.');
  }
}

function completed(r: Runtime, s: Session, event: SpeechEvent): void {
  const capture = s.capture;
  if (!capture) return;
  clearTimeout(s.timer);
  r.pending.add(capture);
  s.capture = null;
  if (s.stopping || !restartingReasons.has(event.reason)) { void cancel(r); return; }
  if (event.reason === 'fallback') {
    if (s.languageFallback) { failed(r, s, 'Dictation could not return to the device language. Your draft was kept. Tap the mic to try again.'); return; }
    s.languageFallback = true;
    s.rapidEnds = 0;
  } else {
    s.rapidEnds = !capture.heard && Date.now() - capture.startedAt < 1000 ? s.rapidEnds + 1 : 0;
  }
  if (s.rapidEnds >= 3) {
    failed(r, s, 'Speech recognition is ending too quickly. Wait a moment and tap the mic again. Your draft was kept.');
    return;
  }
  phase(r, s, 'restarting');
  const delay = Math.min(r.restartMs * 2 ** s.rapidEnds, 2000);
  s.timer = setTimeout(() => { void startCapture(r, s); }, delay);
}

function update(r: Runtime, s: Session, event: SpeechEvent): void {
  const capture = s.capture;
  if (!capture) return;
  if (event.text) {
    const draft = dictationDraft(capture.draft, event.text);
    capture.heard = true;
    s.draft = draft;
    s.text = draft.text;
    r.host.apply(draft);
  }
  if (event.error) { failed(r, s, event.error); return; }
  if (event.notice) r.host.error(event.notice);
  if (event.state === 'ended') { completed(r, s, event); return; }
  if (event.state === 'listening' && capture.state === 'starting') {
    capture.state = 'listening';
    phase(r, s, 'listening');
    clearTimeout(s.timer);
    s.timer = setTimeout(() => { void finishCapture(r, s, true); }, r.limitMs);
  }
  if (event.state === 'finishing') void finishCapture(r, s, false);
}

async function ensureAvailable(r: Runtime, s: Session): Promise<boolean> {
  const status = await r.bridge.availability();
  if (!valid(r, s)) return false;
  if (status.available) {
    if (status.notice) r.host.error(status.notice);
    return true;
  }
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

async function start(r: Runtime): Promise<void> {
  if (r.disposed || r.current) return;
  if (r.voiceStarting || r.host.blocked()) { r.host.error('Stop the call or voice recording before using dictation.'); return; }
  const draft = r.host.read();
  const s: Session = {
    draft, text: draft.text, phase: 'preparing', capture: null,
    stopping: false, rapidEnds: 0,
  };
  r.current = s;
  r.host.error(null);
  phase(r, s, 'preparing');
  try {
    await cleanup(r);
    if (!valid(r, s) || !await ensureAvailable(r, s) || !await permission(r, s)) return;
    await startCapture(r, s);
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

export function makeDictation(bridge: SpeechBridge, host: DictationHost, limitMs = 60_000, finishMs = 5000, restartMs = 250) {
  const r: Runtime = {
    bridge, host, current: null, disposed: false, voiceStarting: false,
    cleanup: Promise.resolve(), pending: new Set(), limitMs, finishMs, restartMs,
  };
  const unsubscribe = bridge.subscribe(event => {
    const s = r.current;
    if (!s || event.sessionId !== s.lastCaptureId || !valid(r, s)) return;
    if (event.state === 'ended' && event.reason === 'cancelled') {
      if (event.error) failed(r, s, event.error);
      else void cancel(r);
      return;
    }
    if (event.sessionId === s.capture?.id) update(r, s, event);
  });
  return {
    start: () => start(r), stop: () => stop(r), cancel: () => cancel(r),
    toggle: () => r.current ? stop(r) : start(r),
    recordVoice: (action: () => Promise<void>) => recordVoice(r, action),
    background: () => { if (!r.current?.permissionPending) void cancel(r); },
    inactive: () => { if (r.current?.capture || r.current?.phase === 'restarting') void cancel(r); },
    edited: () => { if (r.current && host.read().text !== r.current.text) void cancel(r); },
    dispose: (): Promise<void> => {
      if (!r.disposed) { r.disposed = true; unsubscribe(); }
      return cancel(r);
    },
  };
}
