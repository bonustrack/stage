import { useEffect, useState } from 'react';
import { loadAccountsForWrite } from './accounts';
import { readPendingSetup, subscribePendingSetup } from './onboardingPending';
import { report } from './errorPolicy';
import { useAccountEpoch } from './accountEpoch';
import { makeListeners, useStoreValue } from './storeCore';

export interface AccountGate {
  ready: boolean;
  hasAccount: boolean;
}

export function useAccountGate(): AccountGate {
  const epoch = useAccountEpoch();
  const [ready, setReady] = useState(false);
  const [hasAccount, setHasAccount] = useState(false);

  useEffect(() => {
    let generation = 0;
    let alive = true;
    const refresh = (): void => {
      const current = ++generation;
      void Promise.all([loadAccountsForWrite(), readPendingSetup()]).then(([list, pending]) => {
        if (!alive || current !== generation) return;
        setHasAccount(list.length > 0 && pending === null);
        setReady(true);
      }).catch((e: unknown) => {
        if (!alive || current !== generation) return;
        report('onboarding.gate', e);
        setHasAccount(false);
        setReady(true);
      });
    };
    refresh();
    const stop = subscribePendingSetup(refresh);
    return () => { alive = false; stop(); };
  }, [epoch]);

  return { ready, hasAccount };
}

let held = false;
const holdListeners = makeListeners();

function getHeld(): boolean { return held; }

export function holdOnboarding(next: boolean): void {
  if (held === next) return;
  held = next;
  holdListeners.notify();
}

export interface ShellGates {
  showOnboarding: boolean;
  sidebarVisible: boolean;
}

export function useShellGates(gatesOpen: boolean, hasAccount: boolean): ShellGates {
  const holding = useStoreValue(holdListeners.subscribe, getHeld);
  const showOnboarding = !hasAccount || holding;
  return { showOnboarding, sidebarVisible: gatesOpen && hasAccount && !showOnboarding };
}
