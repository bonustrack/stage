
import { useState } from 'react';

import { Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Text } from '@stage-labs/kit/react-native/text';
import { Icon } from '@stage-labs/kit/react-native/icon';
import { Card } from '@stage-labs/kit/react-native/card';
import { ListView, ListViewItem } from '@stage-labs/kit/react-native/list-view';
import { capabilities } from '../../lib/capabilities';
import { Box, Col } from '../layout';
import { flash } from '../../lib/toast';
import { getPrivateKey, canExportPrivateKey, type AccountRecord } from '../../lib/accounts';
import { deleteAccount, shortAddress, useActiveAccountRecord } from '../../modules/messaging';
import { reloadApp } from '../AccountsManager.helpers';
import { SettingsButtonRow, SettingsList, SettingsNavRow } from '../settings/rows';

interface SectionColors { fg: string; head: string; sub: string; border: string; rowBg: string }

interface RevealedKey { id: string; pk: string }

function confirmExport(rec: AccountRecord, setRevealed: (key: RevealedKey) => void): void {
  Alert.alert(
    'Export private key',
    'Anyone with this key controls your account — never share it. Make sure no one can see your screen.',
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
    `Remove ${name}? Without the private key backed up this account is unrecoverable — its local XMTP database is deleted from this device.`,
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => {
          void (async (): Promise<void> => { await deleteAccount(rec.id); reloadApp(); })();
        } },
    ],
  );
}

function RevealedKeyRow({ c, dark, revealed }: {
  c: SectionColors; dark: boolean; revealed: string;
}): React.ReactElement {
  return (
    <ListViewItem
      dark={dark}
      align="start"
      onPress={() => { void Clipboard.setStringAsync(revealed); flash('Private key copied'); }}
      style={{ paddingHorizontal: 14, paddingVertical: 14 }}
    >
      <Icon name="wallet" size={22} color={c.head} />
      <Col flex={1}>
        <Text size="xl" color={c.fg}>Tap to copy private key</Text>
        <Text size="xs" selectable color={c.sub} style={{ marginTop: 4 }}>{revealed}</Text>
      </Col>
      <Icon name="copy" size={20} color={c.head} />
    </ListViewItem>
  );
}

function revealedKeyFor(key: RevealedKey | null, rec: AccountRecord): string | null {
  if (!key) return null;
  return key.id === rec.id ? key.pk : null;
}

export function AccountSecuritySection(
  { c, dark }: { c: SectionColors; danger?: string; dark: boolean },
): React.ReactElement | null {
  const rec = useActiveAccountRecord();
  const [key, setRevealed] = useState<RevealedKey | null>(null);

  if (!rec) return null;
  const revealed = revealedKeyFor(key, rec);

  return (
    <>
      <Text size="xs" color={c.sub} style={{ paddingHorizontal: 16, paddingTop: 24, paddingBottom: 8 }}>ACCOUNT</Text>
      <Box margin={{ x: 16 }} style={{ overflow: 'hidden' }}>
        <Card dark={dark} background={c.rowBg} padding={0}>
          {revealed && canExportPrivateKey(rec) ? (
            <ListView dark={dark}>
              <RevealedKeyRow c={c} dark={dark} revealed={revealed} />
            </ListView>
          ) : null}
          <SettingsList>
            {canExportPrivateKey(rec) && !revealed ? (
              <SettingsNavRow
                label="Export private key"
                iconStart="wallet"
                iconEnd="chevronDown"
                onPress={() => { confirmExport(rec, setRevealed); }}
              />
            ) : null}
            {rec.type === 'smart' ? (
              <SettingsNavRow
                label={(rec.guardians ?? []).length ? 'Guardian recovery' : 'Set up guardian recovery'}
                iconStart="userGroup"
                onPress={() => { capabilities.navigate('/wallet/recovery'); }}
              />
            ) : null}
            <SettingsButtonRow
              label="Remove account"
              iconStart="trash"
              danger
              onPress={() => { confirmRemove(rec); }}
            />
          </SettingsList>
        </Card>
      </Box>
    </>
  );
}
