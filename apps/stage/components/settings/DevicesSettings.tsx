import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert } from 'react-native';
import { Caption } from '@stage-labs/kit/react-native/caption';
import { ListViewItem } from '@stage-labs/kit/react-native/list-view';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Text } from '@stage-labs/kit/react-native/text';
import { useKitScheme } from '@stage-labs/kit/react-native/theme-context';
import { Col } from '../layout';
import { AppIcon } from '../widgets';
import { listXmtpInstallations, revokeXmtpInstallation } from '../../lib/xmtp.client';
import { shortAddress } from '@stage-labs/client/identity/format';
import { useAccountEpoch } from '../../lib/accountEpoch';
import { useActiveAccountRecord } from '../../modules/messaging/account';
import type { XmtpInstallation } from '../../lib/xmtp.client.core';
import { capabilities } from '../../lib/capabilities';
import { transferKindFor } from '../../lib/accountTransfer';
import { historySyncProblem, receiveHistoryWithCode, runHistorySync, useHistorySyncPhase } from '../../lib/history';
import { historySyncIsActive, historySyncPhaseLabel } from '../../lib/history.model';
import { DANGER, useEffectiveColorScheme } from '../../lib/theme';
import { TransferAccountSheet } from '../accounts/TransferAccountSheet';
import { ReceiveCodeSheet, SendHistorySheet } from './HistoryTransferSheets';
import { SettingsButtonRow, SettingsGroup, SettingsNavRow, SettingsPage, SettingsValueRow } from './SettingsPage';
import { IconArrowInbox } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconArrowInbox';
import { IconArrowOutOfBox } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconArrowOutOfBox';
import { IconArrowRotateClockwise } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconArrowRotateClockwise';
import { IconDevices } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconDevices';
import { IconQrCode } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconQrCode';

function addedOn(ms: number | undefined): string {
  if (!ms) return 'Added on an unknown date';
  return `Added ${new Date(ms).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}`;
}

function SessionRow({ inst, busy, onRevoke }: {
  inst: XmtpInstallation; busy: boolean; onRevoke: () => void;
}): React.ReactElement {
  const dark = useKitScheme() === 'dark';
  return (
    <ListViewItem align="center" gap={12} dark={dark}>
      <AppIcon name={IconDevices} color={inst.current ? 'link' : 'secondary'} size={24} />
      <Col flex={1} gap={2}>
        <Text value={inst.current ? 'This device' : `Device ${shortAddress(inst.id)}`} size="2xs" weight="semibold" color="link" />
        <Caption value={addedOn(inst.createdAt)} color="secondary" />
      </Col>
      <Pressable onPress={onRevoke} disabled={busy} hitSlop={8} accessibilityRole="button">
        {busy ? <ActivityIndicator size="small" color={DANGER} /> : <Text value="Revoke" size="3xs" color={DANGER} />}
      </Pressable>
    </ListViewItem>
  );
}

function useSessions(): { list: XmtpInstallation[] | null; error: boolean; reload: () => Promise<void> } {
  const epoch = useAccountEpoch();
  const [list, setList] = useState<XmtpInstallation[] | null>(null);
  const [error, setError] = useState(false);
  const reload = useCallback(async (): Promise<void> => {
    setError(false);
    try { setList(await listXmtpInstallations()); }
    catch { setList([]); setError(true); }
  }, []);
  useEffect(() => { void reload(); }, [reload, epoch]);
  return { list, error, reload };
}

function confirmRevoke(inst: XmtpInstallation, run: () => void): void {
  void capabilities.confirm({
    title: inst.current ? 'Revoke this device?' : 'Revoke session',
    message: inst.current
      ? 'This is the device you are using. Revoking it logs this device out of messaging. You will need to set up XMTP again here.'
      : `Revoke the session ${shortAddress(inst.id)}? That device will lose access to this inbox.`,
    confirmLabel: 'Revoke',
    destructive: true,
  }).then((ok) => { if (ok) run(); });
}

function sessionsNote(list: XmtpInstallation[] | null, error: boolean): string | null {
  if (list === null) return 'Loading sessions…';
  if (error) return 'Messaging is not ready yet. Open a chat first, then come back.';
  return list.length === 0 ? 'No active sessions.' : null;
}

function DeviceSessions(): React.ReactElement {
  const { list, error, reload } = useSessions();
  const [busy, setBusy] = useState<string | null>(null);
  const revoke = (inst: XmtpInstallation): void => {
    confirmRevoke(inst, () => {
      setBusy(inst.id);
      void revokeXmtpInstallation(inst.id)
        .then(() => { capabilities.toast('Session revoked'); return reload(); })
        .catch(() => { Alert.alert('Revoke failed', 'Could not revoke that session. Check your connection and try again.'); })
        .finally(() => { setBusy(null); });
    });
  };
  const note = sessionsNote(list, error);
  return (
    <SettingsGroup title="Sessions" footnote="Every device signed in to this inbox. Revoke the ones you do not use.">
      {note !== null || list === null ? <SettingsValueRow label={note ?? ''} value="" /> : list.map((inst) => (
        <SessionRow key={inst.id} inst={inst} busy={busy === inst.id} onRevoke={() => { revoke(inst); }} />
      ))}
    </SettingsGroup>
  );
}

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

const SYNC_DESC = 'Ask your other devices for the messages this device is missing. Keep Stage open on the other device while it answers.';
const SEND_DESC = 'Package this device\'s history for another device. You will get a code to enter there.';
const RECEIVE_DESC = 'Enter the code shown on the device that sent its history.';

async function receiveFromSettings(code: string): Promise<void> {
  await receiveHistoryWithCode(code);
  capabilities.toast('History imported');
}

function HistorySyncSection(): React.ReactElement {
  const phase = useHistorySyncPhase();
  const [sendOpen, setSendOpen] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const syncing = historySyncIsActive(phase);
  const status = historySyncPhaseLabel(phase, historySyncProblem());
  return (
    <>
      <SettingsGroup title="Chat history">
        <SettingsButtonRow
          label={syncing ? 'Syncing history…' : 'Sync history from another device'}
          description={status ?? SYNC_DESC}
          iconStart={IconArrowRotateClockwise}
          onPress={() => { if (!syncing) void runHistorySync(); }}
        />
        <SettingsButtonRow
          label="Send history to another device"
          description={SEND_DESC}
          iconStart={IconArrowOutOfBox}
          onPress={() => { setSendOpen(true); }}
        />
        <SettingsButtonRow
          label="Receive history with a code"
          description={RECEIVE_DESC}
          iconStart={IconArrowInbox}
          onPress={() => { setReceiveOpen(true); }}
        />
      </SettingsGroup>
      <SendHistorySheet visible={sendOpen} onClose={() => { setSendOpen(false); }} />
      <ReceiveCodeSheet visible={receiveOpen} onClose={() => { setReceiveOpen(false); }} onReceive={receiveFromSettings} />
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
