import type { VoiceFile } from './voice.model';

type Finish = 'send' | 'cancel';

interface VoiceDevice {
  prepare: () => Promise<void>;
  record: () => void;
  stop: () => Promise<void>;
  file: () => Promise<VoiceFile>;
}

interface VoiceCallbacks {
  begin: () => void;
  started: () => void;
  stopped: () => void;
  error: (error: unknown) => void;
  upload: (file: VoiceFile) => Promise<void>;
}

export function makeVoiceRecorder(device: VoiceDevice, callbacks: VoiceCallbacks) {
  let phase: 'idle' | 'preparing' | 'recording' | 'stopping' = 'idle';
  let pending: Finish | null = null;
  let disposed = false;
  let finishing: Promise<void> | null = null;

  const finish = async (): Promise<void> => {
    phase = 'stopping';
    try {
      await device.stop();
      if (pending !== 'send' || disposed) return;
      const file = await device.file();
      if (pending === 'send' && !disposed) await callbacks.upload(file);
    } catch (error) {
      callbacks.error(error);
    } finally {
      phase = 'idle';
      pending = null;
      finishing = null;
      callbacks.stopped();
    }
  };

  const complete = (mode: Finish): Promise<void> => {
    if (phase === 'idle') return Promise.resolve();
    if (pending !== 'cancel') pending = mode;
    if (phase === 'preparing') return Promise.resolve();
    finishing ??= finish();
    return finishing;
  };

  const start = async (): Promise<void> => {
    if (phase !== 'idle' || disposed) return;
    phase = 'preparing';
    pending = null;
    callbacks.begin();
    try {
      await device.prepare();
      phase = 'recording';
      device.record();
      if (pending !== null || disposed) await complete(disposed ? 'cancel' : pending ?? 'cancel');
      else callbacks.started();
    } catch (error) {
      if (phase === 'preparing') {
        phase = 'idle';
        pending = null;
        callbacks.stopped();
      } else await complete('cancel');
      callbacks.error(error);
    }
  };

  const dispose = (): Promise<void> => {
    disposed = true;
    return complete('cancel');
  };

  return { start, stop: () => complete('send'), cancel: () => complete('cancel'), dispose };
}
