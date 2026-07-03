
import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { getActiveAccount } from './accounts';
import { enablePasskeyForRecord, passkeysAvailable, kernelDeployedOnChain } from './zerodev';
import { flash } from './toast';

export function useEnablePasskey(epoch?: number): {
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
      if (!passkeysAvailable() || acct?.type !== 'smart') {
        if (alive) setAvailable(false);
        return;
      }
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
