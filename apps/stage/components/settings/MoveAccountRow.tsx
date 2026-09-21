import { useState } from 'react';
import { useEffectiveColorScheme } from '../../lib/theme';
import { transferKindFor } from '../../lib/accountTransfer';
import { useActiveAccountRecord } from '../../modules/messaging';
import { TransferAccountSheet } from '../accounts/TransferAccountSheet';
import { SettingsNavRow } from './rows';

export function MoveAccountRow(): React.ReactElement | null {
  const dark = useEffectiveColorScheme() === 'dark';
  const rec = useActiveAccountRecord();
  const [moving, setMoving] = useState(false);
  if (rec === null || transferKindFor(rec) === null) return null;
  return (
    <>
      <SettingsNavRow label="Link a device" iconStart="deviceMobile" onPress={() => { setMoving(true); }} />
      <TransferAccountSheet rec={moving ? rec : null} dark={dark} onClose={() => { setMoving(false); }} />
    </>
  );
}
