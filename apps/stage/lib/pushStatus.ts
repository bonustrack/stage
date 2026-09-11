import { makeListeners, useStoreValue } from './storeCore';

export type PushPhase = 'idle' | 'unsupported' | 'disabled' | 'no-token' | 'registering' | 'registered' | 'failed';

export interface PushStatus { phase: PushPhase; detail: string; at: number }

let current: PushStatus = { phase: 'idle', detail: '', at: 0 };
const { listeners, notify } = makeListeners();

export function setPushStatus(phase: PushPhase, detail = ''): void {
  current = { phase, detail, at: Date.now() };
  notify();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

export function usePushStatus(): PushStatus {
  return useStoreValue(subscribe, () => current);
}

export function describePushStatus(status: PushStatus): string {
  switch (status.phase) {
    case 'idle': return 'Push registration has not run yet.';
    case 'unsupported': return 'Push is only available in the mobile app.';
    case 'disabled': return 'Push is turned off on this device.';
    case 'no-token': return 'No device push token: check the system notification permission.';
    case 'registering': return 'Registering with the push server…';
    case 'registered': return `Registered with the push server (${status.detail}).`;
    case 'failed': return `Push registration failed: ${status.detail}`;
  }
}
