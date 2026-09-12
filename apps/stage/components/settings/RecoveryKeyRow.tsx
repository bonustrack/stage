import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import type { AccountRecord } from '../../lib/accounts';
import { flash } from '../../lib/toast';
import type { PasskeyPlace } from '../../lib/zerodev';
import { recoveryKeyCanExecute, setRecoveryKeyAccess } from '../../lib/zerodev/recoveryKeyAccess';
import { SettingsToggleRow, SettingsValueRow } from './rows';

const ALLOW_TEXT =
  'Any device holding your recovery phrase will be able to send transactions from this account, not only sign messages. Continue?';
const REVOKE_TEXT = 'Devices with only the recovery phrase will no longer be able to send transactions. Continue?';
const DESCRIPTION = 'Lets devices with the recovery phrase send transactions, not only sign messages. The passkey stays the root key.';
const ELSEWHERE = 'Only the device holding the passkey can change this.';

function confirmChange(allow: boolean, onConfirm: () => void): void {
  Alert.alert(
    allow ? 'Allow recovery key to transact' : 'Revoke recovery key transactions',
    allow ? ALLOW_TEXT : REVOKE_TEXT,
    [{ text: 'Cancel', style: 'cancel' }, { text: allow ? 'Allow' : 'Revoke', style: allow ? 'destructive' : 'default', onPress: onConfirm }],
  );
}

export function RecoveryKeyRow({ rec, place }: { rec: AccountRecord; place: PasskeyPlace | null }): React.ReactElement | null {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void recoveryKeyCanExecute(rec).then((value) => { if (!cancelled) setAllowed(value); });
    return () => { cancelled = true; };
  }, [rec.address]);

  if (rec.type !== 'smart' || allowed === null || place === null || place === 'none' || place === 'unknown') return null;
  if (place === 'elsewhere') {
    return <SettingsValueRow label="Recovery key can transact" value={allowed ? 'On' : `Off. ${ELSEWHERE}`} />;
  }

  const change = (next: boolean): void => {
    if (busy) return;
    confirmChange(next, () => {
      setBusy(true);
      setStatus(null);
      void setRecoveryKeyAccess(rec, next).then((result) => {
        setBusy(false);
        const text = result.ok
          ? (next ? 'Recovery key can now send transactions.' : 'Recovery key can no longer send transactions.')
          : result.message;
        if (result.ok) setAllowed(next);
        flash(text);
        setStatus(text);
      });
    });
  };

  return (
    <SettingsToggleRow
      label={busy ? 'Updating…' : 'Recovery key can transact'}
      name="recovery-key-transact"
      checked={allowed}
      description={status ?? DESCRIPTION}
      control="switch"
      onChange={change}
    />
  );
}
