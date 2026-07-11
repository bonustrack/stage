
import { useCallback, useEffect, useRef, useState } from 'react';
import { getActiveAccount } from './accounts';
import { capabilities } from './capabilities';
import { removePasskeyFromRecord, passkeysAvailable } from './zerodev';
import { flash } from './toast';

export function useRemovePasskey(epoch?: number, onChanged?: () => void): {
  available: boolean;
  busy: boolean;
  run: () => void;
} {
  const [available, setAvailable] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const acct = await getActiveAccount();
      const ok = passkeysAvailable() && acct?.type === 'smart' && !!acct.passkey;
      if (alive) setAvailable(ok);
    })();
    return () => { alive = false; };
  }, [epoch]);

  const doRemove = useCallback(() => {
    setBusy(true);
    void (async () => {
      try {
        const acct = await getActiveAccount();
        if (!acct) { flash('No active account'); return; }
        const res = await removePasskeyFromRecord(acct);
        if (res.ok) {
          flash('Passkey removed - this account signs with your key again');
          setAvailable(false);
          onChanged?.();
        } else if (res.reason === 'none') {
          flash('This account has no passkey');
          setAvailable(false);
        } else if (res.reason === 'unavailable') {
          flash('Passkeys need the latest app build');
        } else {
          flash(res.message ?? 'Could not remove passkey');
        }
      } finally {
        setBusy(false);
      }
    })();
  }, [onChanged]);

  const confirming = useRef(false);
  const run = useCallback(() => {
    if (busy || confirming.current) return;
    confirming.current = true;
    void (async () => {
      try {
        const ok = await capabilities.confirm({
          title: 'Remove passkey',
          message:
            'This reverts the account to signing with your recovery key instead of the passkey. It LOWERS security: transactions will no longer require Face ID / biometrics. You will confirm this change with your passkey one last time.',
          confirmLabel: 'Remove passkey',
          destructive: true,
        });
        if (ok) doRemove();
      } finally {
        confirming.current = false;
      }
    })();
  }, [busy, doRemove]);

  return { available, busy, run };
}
