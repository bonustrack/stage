import { makeValue } from './storeCore';

type PushPhase = 'idle' | 'disabled' | 'no-token' | 'registering' | 'registered' | 'failed';

interface PushStatus { phase: PushPhase; detail: string; at: number }

const status = makeValue<PushStatus>({ phase: 'idle', detail: '', at: 0 });

export function setPushStatus(phase: PushPhase, detail = ''): void {
  status.set({ phase, detail, at: Date.now() });
}

export const usePushStatus = status.use;

export function describePushStatus(status: PushStatus): string {
  switch (status.phase) {
    case 'idle': return 'Push registration has not run yet.';
    case 'disabled': return 'Push is turned off on this device.';
    case 'no-token': return 'No device push token: check the system notification permission.';
    case 'registering': return 'Registering with the push server…';
    case 'registered': return `Registered with the push server (${status.detail}).`;
    case 'failed': return `Push registration failed: ${status.detail}`;
  }
}
