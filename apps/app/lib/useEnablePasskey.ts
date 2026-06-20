/** @file Shared "Enable passkey" hook for an existing smart account, wrapping enablePasskeyForRecord with confirm + busy + flash; registration runs the OS WebAuthn sheet (and signs the sudo-swap userOp on a deployed Kernel), so `{available}` is false unless this binary can run passkeys and the account lacks one. */

import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { getActiveAccount } from './accounts';
import { enablePasskeyForRecord, passkeysAvailable, kernelDeployedOnChain } from './zerodev';
import { flash } from './toast';

/** Hook providing passkey availability and an action to register one for the active account. */
export function useEnablePasskey(epoch?: number): {
  /** True only when this binary can run passkeys AND the active account is a smart account WITHOUT a passkey yet (so the affordance is worth showing). */
  available: boolean;
  busy: boolean;
  /** Confirm + register + install the passkey; flashes the outcome. Resolves true on success so callers can refresh. */
  run: () => void;
} {
  const [available, setAvailable] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const acct = await getActiveAccount();
      if (!passkeysAvailable() || acct?.type !== 'smart') {
        if (alive) setAvailable(false);
        return;
      }
      /** No passkey -> offer enable; passkey but Kernel not deployed -> offer the repair (re-run enable -> deploy-and-swap); passkey + confirmed deployed -> done; on an RPC error default to not-confirmed and offer the idempotent repair rather than strand a broken undeployed account. */
      let ok = !acct.passkey;
      if (acct.passkey) {
        const deployed = await kernelDeployedOnChain(acct.address).catch(() => false);
        ok = !deployed;
      }
      if (alive) setAvailable(ok);
    })();
    return () => { alive = false; };
  }, [epoch]);

  const doEnable = useCallback(() => {
    setBusy(true);
    void (async () => {
      try {
        const acct = await getActiveAccount();
        if (!acct) { flash('No active account'); return; }
        const res = await enablePasskeyForRecord(acct);
        if (res.ok) {
          flash('Passkey enabled - it now signs every transaction');
          setAvailable(false);
        } else if (res.reason === 'cancelled') {
          flash('Passkey setup cancelled');
        } else if (res.reason === 'already') {
          flash('This account already has a passkey');
          setAvailable(false);
        } else if (res.reason === 'unavailable') {
          flash('Passkeys need the latest app build');
        } else {
          flash(res.message ?? 'Could not enable passkey');
        }
      } finally {
        setBusy(false);
      }
    })();
  }, []);

  const run = useCallback(() => {
    if (busy) return;
    Alert.alert(
      'Enable passkey',
      'Register a passkey on this device to approve every transaction with Face ID / biometrics instead of your recovery key. You can still recover with your phrase.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Enable', style: 'default', onPress: doEnable },
      ],
    );
  }, [busy, doEnable]);

  return { available, busy, run };
}
