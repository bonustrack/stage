import { useEffect, useState } from 'react';
import { loadAccountsForWrite } from './accounts';
import { readPendingSetup, subscribePendingSetup } from './onboardingPending';
import { report } from './errorPolicy';
import { useAccountEpoch } from './accountEpoch';
import { makeValue } from './storeCore';

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
      void Promise.all([loadAccountsForWrite(), readPendingSetup()])
        .then(([list, pending]) => {
          if (!alive || current !== generation) return;
          setHasAccount(list.length > 0 && pending === null);
          setReady(true);
        })
        .catch((e: unknown) => {
          if (!alive || current !== generation) return;
          report('onboarding.gate', e);
          setHasAccount(false);
          setReady(true);
        });
    };
    refresh();
    const stop = subscribePendingSetup(refresh);
    return () => {
      alive = false;
      stop();
    };
  }, [epoch]);

  return { ready, hasAccount };
}

const held = makeValue(false);

export function holdOnboarding(next: boolean): void {
  if (held.get() !== next) held.set(next);
}

export interface ShellGates {
  showOnboarding: boolean;
  sidebarVisible: boolean;
}

export function useShellGates(gatesOpen: boolean, hasAccount: boolean): ShellGates {
  const holding = held.use();
  const showOnboarding = !hasAccount || holding;
  return { showOnboarding, sidebarVisible: gatesOpen && hasAccount && !showOnboarding };
}
