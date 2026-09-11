import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import type { AccountRecord } from '../../lib/accounts';
import { flash } from '../../lib/toast';
import { recoveryKeyCanExecute, setRecoveryKeyAccess } from '../../lib/zerodev/recoveryKeyAccess';
import { SettingsToggleRow } from './rows';

const ALLOW_TEXT =
  'Any device holding your recovery phrase will be able to send transactions from this account, not only sign messages. Continue?';
const REVOKE_TEXT = 'Devices with only the recovery phrase will no longer be able to send transactions. Continue?';

function confirmChange(allow: boolean, onConfirm: () => void): void {
  Alert.alert(
    allow ? 'Allow recovery key to transact' : 'Revoke recovery key transactions',
    allow ? ALLOW_TEXT : REVOKE_TEXT,
    [{ text: 'Cancel', style: 'cancel' }, { text: allow ? 'Allow' : 'Revoke', style: allow ? 'destructive' : 'default', onPress: onConfirm }],
  );
}

export function RecoveryKeyRow({ rec }: { rec: AccountRecord }): React.ReactElement | null {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void recoveryKeyCanExecute(rec).then((value) => { if (!cancelled) setAllowed(value); });
    return () => { cancelled = true; };
  }, [rec.address]);

  if (rec.type !== 'smart' || !rec.passkey || allowed === null) return null;

  const change = (next: boolean): void => {
    if (busy) return;
    confirmChange(next, () => {
      setBusy(true);
      void setRecoveryKeyAccess(rec, next).then((result) => {
        setBusy(false);
        if (result.ok) {
          setAllowed(next);
          flash(next ? 'Recovery key can now send transactions.' : 'Recovery key can no longer send transactions.');
        } else {
          flash(result.message);
        }
      });
    });
  };

  return (
    <SettingsToggleRow
      label={busy ? 'Updating…' : 'Recovery key can transact'}
      name="recovery-key-transact"
      checked={allowed}
      description="Lets devices with the recovery phrase send transactions, not only sign messages. The passkey stays the root key."
      control="switch"
      onChange={change}
    />
  );
}
