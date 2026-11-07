import { errorMessage } from '@stage-labs/client/errors';
import { useActiveAccountRecord } from '../../lib/messaging/account';
import { removeAccountFromDevice, resetXmtpDatabase, useXmtpIdentity } from '../../lib/deviceAccount';
import { shortAddress } from '@stage-labs/client/identity/format';
import type { AccountRecord } from '@stage-labs/client/accounts/types';
import { capabilities } from '../../lib/capabilities';
import { accountName } from '../convIdentity';
import { report, reported } from '../../lib/errorPolicy';
import { SettingsButtonRow, SettingsGroup, SettingsPage, SettingsValueRow } from './SettingsPage';
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

function IdentityGroup(): React.ReactElement | null {
  const id = useXmtpIdentity();
  const rows = [
    { label: 'XMTP address', value: id.addr, short: shortAddress(id.addr) },
    { label: 'Inbox id', value: id.inbox, short: shortAddress(id.inbox) },
    { label: 'Installation id', value: id.install, short: shortAddress(id.install) },
  ].filter((r) => r.value !== '');
  if (rows.length === 0) return null;
  return (
    <SettingsGroup title="XMTP identity" footnote="Tap a value to copy it.">
      {rows.map((r) => (
        <SettingsValueRow
          key={r.label}
          label={r.label}
          value={r.short}
          onPress={() => {
            capabilities.copy(r.label, r.value);
          }}
        />
      ))}
    </SettingsGroup>
  );
}

function DangerGroup(): React.ReactElement {
  const rec = useActiveAccountRecord();
  return (
    <SettingsGroup
      title="Danger zone"
      footnote="Reset clears the messages stored on this device. Remove deletes this account from this device."
    >
      <SettingsButtonRow label="Reset XMTP database" iconStart={IconArrowRotateClockwise} danger onPress={confirmReset} />
      {rec ? (
        <SettingsButtonRow
          label="Remove account"
          iconStart={IconTrashCan}
          danger
          onPress={() => {
            confirmRemove(rec);
          }}
        />
      ) : null}
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
