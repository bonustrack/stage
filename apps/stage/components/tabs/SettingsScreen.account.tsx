
import { useState } from 'react';

import { Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Text } from '@stage-labs/kit/react-native/text';
import { Icon } from '@stage-labs/kit/react-native/icon';
import { Card } from '@stage-labs/kit/react-native/card';
import { ListView, ListViewItem } from '@stage-labs/kit/react-native/list-view';
import { capabilities } from '../../lib/capabilities';
import { Box, Col } from '../layout';
import { getPrivateKey, canExportPrivateKey, loadAccounts, type AccountRecord } from '../../lib/accounts';
import { deleteAccount, shortAddress, useActiveAccountRecord } from '../../modules/messaging';
import { reloadApp } from '../AccountsManager.helpers';
import { transferKindFor } from '../../lib/accountTransfer';
import { TransferAccountSheet } from '../accounts/TransferAccountSheet';
import { SettingsButtonRow, SettingsList, SettingsNavRow } from '../settings/rows';
import { RecoveryKeyRow } from '../settings/RecoveryKeyRow';
import { PasskeyLinkRow, usePasskeyPlace } from '../settings/PasskeyLinkRow';
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
      onPress={() => { void Clipboard.setStringAsync(revealed); capabilities.toast('Private key copied'); }}
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
  return (
    <SettingsList>
      <PasskeyLinkRow rec={rec} place={place} onLinked={() => { setPlace('this-device'); }} />
      <RecoveryKeyRow rec={rec} place={place} />
      {canExportPrivateKey(rec) && !revealed ? (
        <SettingsNavRow label="Export private key" iconStart="wallet" iconEnd="chevronDown" onPress={onExport} />
      ) : null}
      {transferKindFor(rec) !== null ? (
        <SettingsNavRow label="Link a device" iconStart="qrcode" onPress={onMove} />
      ) : null}
      {rec.type === 'smart' ? (
        <SettingsNavRow
          label={(rec.guardians ?? []).length ? 'Guardian recovery' : 'Set up guardian recovery'}
          iconStart="userGroup"
          onPress={() => { capabilities.navigate('/wallet/recovery'); }}
        />
      ) : null}
      <SettingsButtonRow label="Remove account" iconStart="trash" danger onPress={() => { confirmRemove(rec); }} />
    </SettingsList>
  );
}

export function AccountSecuritySection(): React.ReactElement | null {
  const dark = useEffectiveColorScheme() === 'dark';
  const { text, border } = usePalette();
  const rec = useActiveAccountRecord();
  const [key, setRevealed] = useState<RevealedKey | null>(null);
  const [moving, setMoving] = useState(false);

  if (!rec) return null;
  const revealed = revealedKeyFor(key, rec);

  return (
    <>
      <Text size="xs" color={text} style={{ paddingHorizontal: 16, paddingTop: 24, paddingBottom: 8 }}>ACCOUNT</Text>
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
