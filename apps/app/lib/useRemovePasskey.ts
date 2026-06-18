/** Shared "Remove passkey" action for an existing smart account, surfaced in
 *  Settings -> Wallet. The exact inverse of useEnablePasskey: it reverts a
 *  passkey-root Kernel back to ECDSA key-signing via removePasskeyFromRecord.
 *
 *  SECURITY-REDUCING (passkey -> key), so it confirms with a destructive Alert
 *  first. The on-chain swap userOp is authorized by the CURRENT root signer — the
 *  PASSKEY — so completing it proves device possession (no extra gate). State is
 *  cleared fail-closed: rec.passkey is only removed after the swap receipt succeeds.
 *
 *  ON-DEVICE: signing the sudo-swap userOp runs the OS WebAuthn assertion — not
 *  exercisable in CI. {available} hides the affordance unless this binary can run
 *  passkeys AND the active account actually HAS one. */

import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { getActiveAccount } from './accounts';
import { removePasskeyFromRecord, passkeysAvailable } from './zerodev';
import { flash } from './toast';

/** Provides whether a passkey can be removed from the active smart account and a confirm-and-remove action. */
export function useRemovePasskey(epoch?: number, onChanged?: () => void): {
  /** True only when this binary can run passkeys AND the active account is a smart
   *  account that currently HAS a passkey (so removal is meaningful). */
  available: boolean;
  busy: boolean;
  /** Confirm + swap root back to ECDSA + clear stored passkey; flashes the outcome. */
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
          flash(res.message || 'Could not remove passkey');
        }
      } finally {
        setBusy(false);
      }
    })();
  }, [onChanged]);

  const run = useCallback(() => {
    if (busy) return;
    Alert.alert(
      'Remove passkey',
      'This reverts the account to signing with your recovery key instead of the passkey. It LOWERS security: transactions will no longer require Face ID / biometrics. You will confirm this change with your passkey one last time.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove passkey', style: 'destructive', onPress: doRemove },
      ],
    );
  }, [busy, doRemove]);

  return { available, busy, run };
}
