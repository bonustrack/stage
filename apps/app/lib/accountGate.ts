/** First-launch ACCOUNT gate — does any wallet exist yet?
 *
 *  The real onboarding (components/onboarding) is the PRIMARY entry: it shows
 *  whenever the account registry is empty, and goes away the moment an account
 *  is created (the create/restore flow calls addSmartAccount, which bumps the
 *  account epoch). This replaces the old "seen a boolean once" gate as the boot
 *  decision for whether to onboard — we gate on real state (an account exists),
 *  not on a flag, so a fresh install always lands on Welcome.
 *
 *  `ready` waits for the one-time registry load so a returning user (accounts
 *  persisted) never flashes onboarding for a frame. `useAccountEpoch` repaints
 *  the gate the instant an account is added/switched. */

import { useEffect, useState } from 'react';
import { loadAccounts } from './accounts';
import { useAccountEpoch } from './accountEpoch';

export interface AccountGate {
  /** False until the one-time registry load resolved — render the boot spinner
   *  (not onboarding) while this is false so a returning user never flashes it. */
  ready: boolean;
  /** Whether at least one account exists (true -> let the user into the app). */
  hasAccount: boolean;
}

/** Root-layout gate: load the registry once, then re-derive on every account
 *  epoch bump (create / restore / switch). Keeps app/_layout.tsx thin. */
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
