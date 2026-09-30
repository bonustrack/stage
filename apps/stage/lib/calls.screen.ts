import { nativeCalls } from '../modules/stage-calls';
import { report } from './errorPolicy';

let picker: (() => void) | null = null;
let cancelPending: (() => void) | null = null;

export function registerScreenPicker(show: () => void): () => void {
  picker = show;
  return () => { if (picker === show) picker = null; };
}

export function cancelScreenPicker(): void {
  cancelPending?.();
}

export function startScreenPicker(): Promise<boolean> {
  const show = picker;
  if (!show) return Promise.resolve(false);
  cancelScreenPicker();
  return new Promise(resolve => {
    let finished = false;
    const finish = (started: boolean): void => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      subscription.remove();
      cancelPending = null;
      resolve(started);
    };
    const subscription = nativeCalls.addListener('onScreenShare', event => { finish(event.started); });
    const timer = setTimeout(() => { finish(false); }, 30_000);
    cancelPending = () => { finish(false); };
    try { show(); } catch (error) { finish(false); report('calls.picker', error); }
  });
}
