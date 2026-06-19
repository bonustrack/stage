/** @file First-launch account gate: decides whether to show onboarding based on real state (does any account exist) rather than a flag, waiting for the one-time registry load so returning users never flash onboarding. */

import { useEffect, useState } from 'react';
import { loadAccounts } from './accounts';
import { useAccountEpoch } from './accountEpoch';

export interface AccountGate {
  /** False until the one-time registry load resolved — render the boot spinner (not onboarding) while this is false so a returning user never flashes it. */
  ready: boolean;
  /** Whether at least one account exists (true -> let the user into the app). */
  hasAccount: boolean;
}

/** Root-layout gate: load the registry once, then re-derive on every account epoch bump (create / restore / switch). Keeps app/_layout.tsx thin. */
export function useAccountGate(): AccountGate {
  const epoch = useAccountEpoch();
  const [ready, setReady] = useState(false);
  const [hasAccount, setHasAccount] = useState(false);

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
