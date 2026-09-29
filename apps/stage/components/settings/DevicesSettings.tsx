import { useState } from 'react';
import { useActiveAccountRecord } from '../../modules/messaging';
import { transferKindFor } from '../../lib/accountTransfer';
import { useEffectiveColorScheme } from '../../lib/theme';
import { TransferAccountSheet } from '../accounts/TransferAccountSheet';
import { DeviceSessions } from './DeviceSessions';
import { HistorySyncSection } from './HistorySyncSection';
import { SettingsGroup, SettingsPage } from './SettingsPage';
import { SettingsNavRow } from './rows';
import { IconQrCode } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconQrCode';

function LinkDeviceGroup(): React.ReactElement | null {
  const dark = useEffectiveColorScheme() === 'dark';
  const rec = useActiveAccountRecord();
  const [open, setOpen] = useState(false);
  if (rec === null || transferKindFor(rec) === null) return null;
  return (
    <>
      <SettingsGroup title="Add a device" footnote="Scan the code with Stage on your other phone or computer to sign in there.">
        <SettingsNavRow label="Link a device" iconStart={IconQrCode} onPress={() => { setOpen(true); }} />
      </SettingsGroup>
      <TransferAccountSheet rec={open ? rec : null} dark={dark} onClose={() => { setOpen(false); }} />
    </>
  );
}

export function DevicesSettings(): React.ReactElement {
  return (
    <SettingsPage title="Devices">
      <DeviceSessions/>
      <LinkDeviceGroup/>
      <HistorySyncSection/>
    </SettingsPage>
  );
}
