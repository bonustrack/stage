import { Fragment, useState } from 'react';

import { Alert } from 'react-native';
import { Text } from '@stage-labs/kit/react-native/text';
import { Icon } from '@stage-labs/kit/react-native/icon';
import { Card } from '@stage-labs/kit/react-native/card';
import { ListView, ListViewItem } from '@stage-labs/kit/react-native/list-view';
import { capabilities } from '../../lib/capabilities';
import { Box, Col } from '../layout';
import { getPrivateKey, canExportPrivateKey, loadAccounts, type AccountRecord } from '../../lib/accounts';
import { deleteAccount, shortAddress, useActiveAccountRecord } from '../../modules/messaging';
import { reloadApp } from '../../lib/reloadApp';
import { transferKindFor } from '../../lib/accountTransfer';
import { TransferAccountSheet } from '../accounts/TransferAccountSheet';
import { SettingsButtonRow, SettingsList, SettingsNavRow } from '../settings/rows';
import { RecoveryKeyRow } from '../settings/RecoveryKeyRow';
import { SettingsSectionLabel } from '../settings/SettingsPage';
import { PasskeyLinkRow, usePasskeyPlace } from '../settings/PasskeyLinkRow';
import { RecoveryPhraseRow, useWalletBackedUp } from '../settings/RecoveryPhraseRow';
import { passkeyActionLabel, securityRows, type SecurityRowKey } from '../settings/SecuritySettings.model';
import { useEnablePasskey, useRemovePasskey } from '../../lib/passkey';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';

interface RevealedKey { id: string; pk: string }

function confirmExport(rec: AccountRecord, setRevealed: (key: RevealedKey) => void): void {
  Alert.alert(
    'Export private key',
    'Anyone with this key controls your account. Never share it, and make sure no one can see your screen.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reveal key', style: 'destructive', onPress: () => {
          void (async (): Promise<void> => {
            const pk = await getPrivateKey(rec.id);
            if (!pk) { Alert.alert('No key', 'This account has no exportable private key.'); return; }
            setRevealed({ id: rec.id, pk });
          })();
        } },
    ],
  );
}

function confirmRemove(rec: AccountRecord): void {
  const name = rec.label ?? shortAddress(rec.address ?? '');
  Alert.alert(
    'Remove account',
    `Remove ${name}? Without a backup of the private key this account is unrecoverable. Its local XMTP database is deleted from this device.`,
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => {
          void (async (): Promise<void> => {
            await deleteAccount(rec.id);
            const remaining = await loadAccounts();
            reloadApp(remaining.length === 0);
          })();
        } },
    ],
  );
}

function RevealedKeyRow({ dark, revealed }: { dark: boolean; revealed: string }): React.ReactElement {
  const { text, link } = usePalette();
  return (
    <ListViewItem
      dark={dark}
      align="start"
      onPress={() => { capabilities.copy('Private key', revealed); }}
      style={{ paddingHorizontal: 14, paddingVertical: 14 }}
    >
      <Icon name="wallet" size={24} color={link} />
      <Col flex={1}>
        <Text size="xl" color={text}>Tap to copy private key</Text>
        <Text size="xs" selectable color={text} style={{ marginTop: 4 }}>{revealed}</Text>
      </Col>
      <Icon name="copy" size={20} color={link} />
    </ListViewItem>
  );
}

function revealedKeyFor(key: RevealedKey | null, rec: AccountRecord): string | null {
  if (!key) return null;
  return key.id === rec.id ? key.pk : null;
}

function AccountRows({ rec, revealed, onExport, onMove }: {
  rec: AccountRecord; revealed: string | null; onExport: () => void; onMove: () => void;
}): React.ReactElement {
  const [place, setPlace] = usePasskeyPlace(rec);
  const enablePasskey = useEnablePasskey();
  const removePasskey = useRemovePasskey();
  const backedUp = useWalletBackedUp();
  const keys = securityRows({
    isSmart: rec.type === 'smart', backedUp,
    enablePasskey: enablePasskey.available, removePasskey: removePasskey.available,
    canExportKey: canExportPrivateKey(rec), keyRevealed: revealed !== null, canLinkDevice: transferKindFor(rec) !== null,
  });
  const rows: Record<SecurityRowKey, () => React.ReactElement | null> = {
    backupPhrase: () => <RecoveryPhraseRow rec={rec} />,
    enablePasskey: () => <SettingsButtonRow label={passkeyActionLabel('enable', enablePasskey.busy)} iconStart="fingerPrint" onPress={enablePasskey.run} />,
    passkeyLink: () => <PasskeyLinkRow rec={rec} place={place} onLinked={() => { setPlace('this-device'); }} />,
    recoveryKey: () => <RecoveryKeyRow rec={rec} place={place} />,
    removePasskey: () => <SettingsButtonRow label={passkeyActionLabel('remove', removePasskey.busy)} iconStart="fingerPrint" onPress={removePasskey.run} />,
    exportKey: () => <SettingsNavRow label="Export private key" iconStart="wallet" iconEnd="chevronDown" onPress={onExport} />,
    linkDevice: () => <SettingsNavRow label="Link a device" iconStart="qrcode" onPress={onMove} />,
    removeAccount: () => <SettingsButtonRow label="Remove account" iconStart="trash" danger onPress={() => { confirmRemove(rec); }} />,
  };
  return (
    <SettingsList>
      {keys.map((key) => <Fragment key={key}>{rows[key]()}</Fragment>)}
    </SettingsList>
  );
}

export function AccountSecuritySection(): React.ReactElement | null {
  const dark = useEffectiveColorScheme() === 'dark';
  const { border } = usePalette();
  const rec = useActiveAccountRecord();
  const [key, setRevealed] = useState<RevealedKey | null>(null);
  const [moving, setMoving] = useState(false);

  if (!rec) return null;
  const revealed = revealedKeyFor(key, rec);

  return (
    <>
      <SettingsSectionLabel>ACCOUNT</SettingsSectionLabel>
      <Box margin={{ x: 16 }} style={{ overflow: 'hidden' }}>
        <Card dark={dark} background={border} padding={0}>
          {revealed && canExportPrivateKey(rec) ? (
            <ListView dark={dark}>
              <RevealedKeyRow dark={dark} revealed={revealed} />
            </ListView>
          ) : null}
          <AccountRows
            rec={rec} revealed={revealed}
            onExport={() => { confirmExport(rec, setRevealed); }}
            onMove={() => { setMoving(true); }}
          />
        </Card>
      </Box>
      <TransferAccountSheet rec={moving ? rec : null} dark={dark} onClose={() => { setMoving(false); }} />
    </>
  );
}
