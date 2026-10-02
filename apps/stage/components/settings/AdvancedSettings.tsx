import { useQuery } from '@tanstack/react-query';
import { Alert } from 'react-native';
import { errorMessage } from '@stage-labs/client/errors';
import { AccountManager, useActiveAccountRecord } from '../../modules/messaging/account';
import { deleteAccount, getOrCreateXmtpClient, resetActiveXmtpStore, selfEthAddress } from '../../lib/xmtp.client';
import { shortAddress } from '@stage-labs/client/identity/format';
import { useAccountEpoch } from '../../lib/accountEpoch';
import { getActiveAccount, type AccountRecord } from '../../lib/accounts';
import { reloadApp } from '../../lib/reloadApp';
import { capabilities } from '../../lib/capabilities';
import { report } from '../../lib/errorPolicy';
import { SettingsButtonRow, SettingsGroup, SettingsPage, SettingsValueRow } from './SettingsPage';
import { IconArrowRotateClockwise } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconArrowRotateClockwise';
import { IconTrashCan } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconTrashCan';

function confirmReset(): void {
  void capabilities.confirm({
    title: 'Reset XMTP database',
    message: 'Wipes the local XMTP database of the current account only. The account and its keys stay. Messages stored on this device for this account are gone. A fresh installation is created on next launch.',
    confirmLabel: 'Reset',
    destructive: true,
  }).then(async (ok) => {
    if (!ok) return;
    await resetActiveXmtpStore();
    reloadApp();
  });
}

async function removeAndMoveOn(id: string): Promise<void> {
  try {
    await deleteAccount(id);
    const next = (await getActiveAccount())?.id;
    if (next === undefined) { reloadApp(true); return; }
    await AccountManager.switch(next);
    capabilities.navigate('/');
  } catch (err) {
    report('settings.removeAccount', err);
    Alert.alert('Could not remove account', errorMessage(err));
  }
}

function confirmRemove(rec: AccountRecord): void {
  const name = rec.label ?? shortAddress(rec.address);
  void capabilities.confirm({
    title: 'Remove account',
    message: `Remove ${name}? Without a backup of the private key this account is unrecoverable. Its local XMTP database is deleted from this device.`,
    confirmLabel: 'Remove',
    destructive: true,
  }).then((ok) => { if (ok) void removeAndMoveOn(rec.id); });
}

interface XmtpIdentity { addr: string; inbox: string; install: string }

const NO_IDENTITY: XmtpIdentity = { addr: '', inbox: '', install: '' };

async function fetchXmtpIdentity(): Promise<XmtpIdentity> {
  const client = await getOrCreateXmtpClient('production');
  const address = await selfEthAddress();
  return { addr: address ?? '', inbox: client.inboxId, install: client.installationId ?? '' };
}

function IdentityGroup(): React.ReactElement | null {
  const epoch = useAccountEpoch();
  const { data: id = NO_IDENTITY } = useQuery({ queryKey: ['xmtpIdentity', epoch], queryFn: fetchXmtpIdentity, staleTime: Infinity });
  const rows = [
    { label: 'XMTP address', value: id.addr, short: shortAddress(id.addr) },
    { label: 'Inbox id', value: id.inbox, short: shortAddress(id.inbox) },
    { label: 'Installation id', value: id.install, short: shortAddress(id.install) },
  ].filter((r) => r.value !== '');
  if (rows.length === 0) return null;
  return (
    <SettingsGroup title="XMTP identity" footnote="Tap a value to copy it.">
      {rows.map((r) => (
        <SettingsValueRow key={r.label} label={r.label} value={r.short} onPress={() => { capabilities.copy(r.label, r.value); }} />
      ))}
    </SettingsGroup>
  );
}

function DangerGroup(): React.ReactElement {
  const rec = useActiveAccountRecord();
  return (
    <SettingsGroup title="Danger zone" footnote="Reset clears the messages stored on this device. Remove deletes this account from this device.">
      <SettingsButtonRow label="Reset XMTP database" iconStart={IconArrowRotateClockwise} danger onPress={confirmReset} />
      {rec ? <SettingsButtonRow label="Remove account" iconStart={IconTrashCan} danger onPress={() => { confirmRemove(rec); }} /> : null}
    </SettingsGroup>
  );
}

export function AdvancedSettings(): React.ReactElement {
  return (
    <SettingsPage title="Advanced">
      <IdentityGroup/>
      <DangerGroup/>
    </SettingsPage>
  );
}
