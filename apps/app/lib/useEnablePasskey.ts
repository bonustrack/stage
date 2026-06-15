/** Shared "Enable passkey" action for an existing smart account, surfaced in
 *  Settings -> Wallet and the Secure-your-wallet nudge. Wraps the keyring-safe
 *  enablePasskeyForRecord flow with a confirm + busy + flash, so the two UI
 *  call-sites stay declarative (no duplicated orchestration).
 *
 *  ON-DEVICE: registering the passkey runs the OS WebAuthn create() sheet, and a
 *  DEPLOYED Kernel additionally signs the sudo-swap userOp on-device — neither is
 *  exercisable in CI. The hook returns {available} so a binary without the passkey
 *  native module (or an account that already has one) hides the affordance. */

import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { getActiveAccount } from './accounts';
import { enablePasskeyForRecord, passkeysAvailable, kernelDeployedOnChain } from './zerodev';
import { flash } from './toast';

export function useEnablePasskey(epoch?: number): {
  /** True only when this binary can run passkeys AND the active account is a smart
   *  account WITHOUT a passkey yet (so the affordance is worth showing). */
  available: boolean;
  busy: boolean;
  /** Confirm + register + install the passkey; flashes the outcome. Resolves true
   *  on success so callers can refresh. */
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
      // No passkey yet -> offer enable. HAS a passkey but the Kernel is NOT deployed
      // on-chain -> the old broken counterfactual shortcut left it un-installed
      // (passkey userOps revert with the meta-factory `Unauthorized`); offer the
      // REPAIR (re-run enable -> deploy-and-swap). HAS a passkey + CONFIRMED deployed
      // -> done. On an RPC error we CANNOT confirm deployment, so default to
      // not-confirmed (false) and OFFER the repair: re-running enable on an
      // already-correct account is idempotent (enablePasskeyForRecord re-checks
      // on-chain and returns `already`), whereas hiding it would strand a broken,
      // undeployed passkey account with no way to deploy + swap.
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
          flash(res.message || 'Could not enable passkey');
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
