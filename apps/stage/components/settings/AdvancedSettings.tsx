import { useQuery } from '@tanstack/react-query';
import { useActiveAccountRecord } from '../../modules/messaging/account';
import { getOrCreateXmtpClient, resetActiveXmtpStore, selfEthAddress } from '../../lib/xmtp.client';
import { shortAddress } from '@stage-labs/client/identity/format';
import { useAccountEpoch } from '../../lib/accountEpoch';
import { reloadApp } from '../../lib/reloadApp';
import { capabilities } from '../../lib/capabilities';
import { SettingsButtonRow, SettingsGroup, SettingsPage, SettingsValueRow } from './SettingsPage';
import { confirmDelete, confirmRemove } from './accountRemoval';
import { DANGER_FOOTNOTE } from './accountRemoval.model';
import { IconArrowRotateClockwise } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconArrowRotateClockwise';
import { IconTrashCan } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconTrashCan';

function confirmReset(): void {
  void capabilities
    .confirm({
      title: 'Reset XMTP database',
      message:
        'Wipes the local XMTP database of the current account only. The account and its keys stay. Messages stored on this device for this account are gone. A fresh installation is created on next launch.',
      confirmLabel: 'Reset',
      destructive: true,
    })
    .then(async (ok) => {
      if (!ok) return;
      await resetActiveXmtpStore();
      reloadApp();
    });
}

interface XmtpIdentity {
  addr: string;
  inbox: string;
  install: string;
}

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
    <SettingsGroup title="Danger zone" footnote={DANGER_FOOTNOTE}>
      <SettingsButtonRow label="Reset XMTP database" iconStart={IconArrowRotateClockwise} danger onPress={confirmReset} />
      {rec ? (
        <>
          <SettingsButtonRow
            label="Remove from this device"
            iconStart={IconTrashCan}
            danger
            onPress={() => {
              confirmRemove(rec);
            }}
          />
          <SettingsButtonRow
            label="Delete account"
            iconStart={IconTrashCan}
            danger
            onPress={() => {
              confirmDelete(rec);
            }}
          />
        </>
      ) : null}
    </SettingsGroup>
  );
}

export function AdvancedSettings(): React.ReactElement {
  return (
    <SettingsPage title="Advanced">
      <IdentityGroup />
      <DangerGroup />
    </SettingsPage>
  );
}
