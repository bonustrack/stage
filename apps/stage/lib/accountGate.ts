import { useEffect, useState } from 'react';
import { hasAccounts, loadAccounts } from './accounts';
import { useAccountEpoch } from './accountEpoch';
import { reported } from './errorPolicy';
import { makeListeners, useStoreValue } from './storeCore';
import { primeReadStateStore } from './xmtp.unread';

export interface AccountGate {
  ready: boolean;
  hasAccount: boolean;
}

export function useAccountGate(): AccountGate {
  const epoch = useAccountEpoch();
  const [ready, setReady] = useState(false);
  const [hasAccount, setHasAccount] = useState(false);

  useEffect(() => {
    void hasAccounts().then(primeReadStateStore).catch(reported('readState.prime'));
  }, []);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const list = await loadAccounts();
      if (!alive) return;
      setHasAccount(list.length > 0);
      setReady(true);
    })();
    return () => { alive = false; };
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
