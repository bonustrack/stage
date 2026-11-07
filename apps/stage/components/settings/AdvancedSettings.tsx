import { errorMessage } from '@stage-labs/client/errors';
import { useActiveAccount } from '../../lib/messaging/account';
import { removeAccountFromDevice, resetXmtpDatabase, useXmtpIdentity } from '../../lib/deviceAccount';
import { shortAddress } from '@stage-labs/client/identity/format';
import type { AccountRecord } from '@stage-labs/client/accounts/types';
import { capabilities } from '../../lib/capabilities';
import { accountName } from '../../lib/convIdentity';
import { report, reported } from '../../lib/errorPolicy';
import {
  SettingsButtonPlaceholderRow,
  SettingsButtonRow,
  SettingsGroup,
  SettingsPage,
  SettingsValuePlaceholderRow,
  SettingsValueRow,
} from './SettingsPage';
import { IconArrowRotateClockwise } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconArrowRotateClockwise';
import { IconTrashCan } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconTrashCan';

const RESET_CONFIRM = {
  title: 'Reset XMTP database',
  message:
    'Wipes the local XMTP database of the current account only. The account and its keys stay. Messages stored on this device for this account are gone. A fresh installation is created on next launch.',
};

function confirmReset(): void {
  void resetXmtpDatabase(RESET_CONFIRM).catch(reported('settings.resetDatabase'));
}

async function removeAndMoveOn(id: string): Promise<void> {
  try {
    await removeAccountFromDevice(id);
  } catch (err) {
    report('settings.removeAccount', err);
    capabilities.alert('Could not remove account', errorMessage(err));
  }
}

function confirmRemove(rec: AccountRecord): void {
  const name = accountName(rec);
  void capabilities
    .confirm({
      title: 'Remove account',
      message: `Remove ${name}? Without a backup of the private key this account is unrecoverable. Its local XMTP database is deleted from this device.`,
      confirmLabel: 'Remove',
      destructive: true,
    })
    .then((ok) => {
      if (ok) void removeAndMoveOn(rec.id);
    });
}

const IDENTITY_ROWS = [
  { label: 'XMTP address', key: 'addr' },
  { label: 'Inbox id', key: 'inbox' },
  { label: 'Installation id', key: 'install' },
] as const;

function IdentityGroup(): React.ReactElement | null {
  const id = useXmtpIdentity();
  const rows = id === null ? [] : IDENTITY_ROWS.map((r) => ({ label: r.label, value: id[r.key] })).filter((r) => r.value !== '');
  if (id !== null && rows.length === 0) return null;
  return (
    <SettingsGroup title="XMTP identity" footnote="Tap a value to copy it.">
      {id === null
        ? IDENTITY_ROWS.map((r) => <SettingsValuePlaceholderRow key={r.label} label={r.label} />)
        : rows.map((r) => (
            <SettingsValueRow
              key={r.label}
              label={r.label}
              value={shortAddress(r.value)}
              onPress={() => {
                capabilities.copy(r.label, r.value);
              }}
            />
          ))}
    </SettingsGroup>
  );
}

function RemoveAccountRow(): React.ReactElement | null {
  const { record, loaded } = useActiveAccount();
  if (!loaded) return <SettingsButtonPlaceholderRow />;
  if (record === null) return null;
  return (
    <SettingsButtonRow
      label="Remove account"
      iconStart={IconTrashCan}
      danger
      onPress={() => {
        confirmRemove(record);
      }}
    />
  );
}

function DangerGroup(): React.ReactElement {
  return (
    <SettingsGroup
      title="Danger zone"
      footnote="Reset clears the messages stored on this device. Remove deletes this account from this device."
    >
      <SettingsButtonRow label="Reset XMTP database" iconStart={IconArrowRotateClockwise} danger onPress={confirmReset} />
      <RemoveAccountRow />
    </SettingsGroup>
  );
}

export function AdvancedSettings(): React.ReactElement {
  return (
    <SettingsPage section="advanced">
      <IdentityGroup />
      <DangerGroup />
    </SettingsPage>
  );
}
