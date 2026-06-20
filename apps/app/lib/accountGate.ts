
import { useEffect, useState } from 'react';
import { loadAccounts } from './accounts';
import { useAccountEpoch } from './accountEpoch';

export interface AccountGate {
  ready: boolean;
  hasAccount: boolean;
}

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
