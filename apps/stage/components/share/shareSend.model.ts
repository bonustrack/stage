export function currentShareDraft<T>(draft: { text: string; pending: T[] }, started: { text: string; pending: T[] }): { text: string; pending: T[] } {
  return {
    text: draft.text === started.text ? '' : draft.text,
    pending: draft.pending === started.pending ? [] : draft.pending,
  };
}

export interface ShareSendEffects<T> {
  validate: () => Promise<() => void>;
  start: (assertCurrent: () => void) => T;
  finish: (started: T) => Promise<boolean>;
  success: () => Promise<void>;
  busy: (value: boolean) => void;
  error: () => void;
}

export function makeShareSender<T>(effects: ShareSendEffects<T>): { send: () => Promise<void>; isBusy: () => boolean; close: () => boolean } {
  let busy = false;
  let closed = false;
  return {
    isBusy: () => busy,
    close: () => { if (busy) return false; closed = true; return true; },
    send: async () => {
      if (busy || closed) return;
      busy = true;
      effects.busy(true);
      try {
        const assertCurrent = await effects.validate();
        assertCurrent();
        const started = effects.start(assertCurrent);
        if (await effects.finish(started)) await effects.success();
      } catch {
        effects.error();
      } finally {
        busy = false;
        effects.busy(false);
      }
    },
  };
}
