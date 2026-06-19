/**
 * @file Account-security section of the Settings tab providing Alert-gated export-private-key and remove-account actions for the active account.
 */

import { useEffect, useState } from 'react';

import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { Text } from '@metro-labs/kit/text';
import { Icon } from '@metro-labs/kit/icon';
import { Card } from '@metro-labs/kit/card';
import { ListView, ListViewItem } from '@metro-labs/kit/list-view';
import { Box, Col } from '../layout';
import { flash } from '../../lib/toast';
import {
  getActiveAccount, getPrivateKey, canExportPrivateKey, type AccountRecord,
} from '../../lib/accounts';
import { deleteAccount, shortAddress, useActiveAccount } from '../../modules/messaging';
import { reloadApp } from '../AccountsManager.helpers';

interface SectionColors { fg: string; head: string; sub: string; border: string; rowBg: string }

/** Alert-gated reveal of the active account's private key, setting `revealed` on confirm. */
function confirmExport(rec: AccountRecord, setRevealed: (pk: string) => void): void {
  Alert.alert(
    'Export private key',
    'Anyone with this key controls your account — never share it. Make sure no one can see your screen.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reveal key', style: 'destructive', onPress: () => {
          void (async (): Promise<void> => {
            const pk = await getPrivateKey(rec.id);
            if (!pk) { Alert.alert('No key', 'This account has no exportable private key.'); return; }
            setRevealed(pk);
          })();
        } },
    ],
  );
}

/** Alert-gated removal of the active account, reloading the app on confirm. */
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

/** Export-private-key row: confirms before revealing, then taps-to-copy the revealed key. */
function ExportKeyRow({ c, dark, rec, revealed, setRevealed }: {
  c: SectionColors; dark: boolean; rec: AccountRecord; revealed: string | null; setRevealed: (pk: string) => void;
}): React.ReactElement {
  return (
    <ListViewItem
      dark={dark}
      align={revealed ? 'start' : 'center'}
      onPress={revealed
        ? () => { void Clipboard.setStringAsync(revealed); flash('Private key copied'); }
        : () => { confirmExport(rec, setRevealed); }}
      style={{ paddingHorizontal: 14, paddingVertical: 14 }}
    >
      <Icon name="wallet" size={22} color={c.head} />
      <Col flex={1}>
        <Text size="xl" color={c.fg}>{revealed ? 'Tap to copy private key' : 'Export private key'}</Text>
        {revealed ? <Text size="xs" selectable color={c.sub} style={{ marginTop: 4 }}>{revealed}</Text> : null}
      </Col>
      <Icon name={revealed ? 'copy' : 'chevronDown'} size={20} color={c.head} />
    </ListViewItem>
  );
}

/** Guardian-recovery row for smart accounts (label depends on whether guardians are set). */
function RecoveryRow({ c, dark, rec, onPress }: {
  c: SectionColors; dark: boolean; rec: AccountRecord; onPress: () => void;
}): React.ReactElement {
  return (
    <ListViewItem dark={dark} onPress={onPress} style={{ paddingHorizontal: 14, paddingVertical: 14 }}>
      <Icon name="userGroup" size={22} color={c.head} />
      <Text size="xl" color={c.fg} style={{ flex: 1 }}>
        {(rec.guardians ?? []).length ? 'Guardian recovery' : 'Set up guardian recovery'}
      </Text>
      <Icon name="chevronRight" size={20} color={c.head} />
    </ListViewItem>
  );
}

/** Track the active account record + clear the revealed key whenever the active account changes. */
function useActiveRecord(epoch: number): [AccountRecord | null, string | null, React.Dispatch<React.SetStateAction<string | null>>] {
  const [rec, setRec] = useState<AccountRecord | null>(null);
  const [revealed, setRevealed] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void (async (): Promise<void> => {
      const active = await getActiveAccount();
      if (alive) { setRec(active); setRevealed(null); }
    })();
    return () => { alive = false; };
  }, [epoch]);
  return [rec, revealed, setRevealed];
}

/** Settings section presenting account security options and danger-zone actions. */
export function AccountSecuritySection(
  { c, danger, dark }: { c: SectionColors; danger: string; dark: boolean },
): React.ReactElement | null {
  const epoch = useActiveAccount();
  const router = useRouter();
  const [rec, revealed, setRevealed] = useActiveRecord(epoch);

  if (!rec) return null;
  return (
    <>
      <Text size="xs" color={c.sub} style={{ paddingHorizontal: 16, paddingTop: 24, paddingBottom: 8 }}>ACCOUNT</Text>
      <Box margin={{ x: 16 }} style={{ overflow: 'hidden' }}>
        <Card dark={dark} background={c.rowBg} padding={0}>
          <ListView dark={dark}>
            {canExportPrivateKey(rec)
              ? <ExportKeyRow c={c} dark={dark} rec={rec} revealed={revealed} setRevealed={setRevealed} />
              : null}
            {rec.type === 'smart'
              ? <RecoveryRow c={c} dark={dark} rec={rec} onPress={() => { router.push('/wallet/recovery'); }} />
              : null}
            <ListViewItem dark={dark} onPress={() => { confirmRemove(rec); }} style={{ paddingHorizontal: 14, paddingVertical: 14 }}>
              <Icon name="trash" size={22} color={danger} />
              <Text size="xl" color={danger} style={{ flex: 1 }}>Remove account</Text>
            </ListViewItem>
          </ListView>
        </Card>
      </Box>
    </>
  );
}
