import { makeListeners } from './storeCore';

export type TabRole = 'pending' | 'active' | 'standby';

type LockGranted = (lock: unknown) => Promise<void>;

interface LockRequestOptions {
  ifAvailable?: boolean;
  steal?: boolean;
}

export interface LockRequester {
  request(name: string, options: LockRequestOptions, callback: LockGranted): Promise<unknown>;
}

export interface TabLock {
  role: () => TabRole;
  subscribe: (listener: () => void) => () => void;
  takeOver: () => void;
}

export const ACTIVE_TAB: TabLock = {
  role: () => 'active',
  subscribe: () => () => undefined,
  takeOver: () => undefined,
};

export function createTabLock(locks: LockRequester, name: string, onLost: () => void): TabLock {
  let current: TabRole = 'pending';
  let taking = false;
  const listeners = makeListeners();
  const set = (next: TabRole): void => {
    if (current === next) return;
    current = next;
    listeners.notify();
  };
  const hold: LockGranted = () => {
    set('active');
    return new Promise<void>(() => undefined);
  };
  const failed = (): void => {
    if (current === 'active') onLost();
    else if (current === 'pending') set('active');
  };
  const wait = (): Promise<void> => {
    set('standby');
    void locks.request(name, {}, hold).catch(failed);
    return Promise.resolve();
  };
  void locks.request(name, { ifAvailable: true }, (lock) => (lock ? hold(lock) : wait())).catch(failed);
  return {
    role: () => current,
    subscribe: listeners.subscribe,
    takeOver() {
      if (current !== 'standby' || taking) return;
      taking = true;
      void locks.request(name, { steal: true }, hold).catch(failed);
    },
  };
}
