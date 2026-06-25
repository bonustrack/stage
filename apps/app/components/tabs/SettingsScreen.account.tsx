
import { useEffect, useState } from 'react';

import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { Text } from '@stage-labs/kit/react-native/text';
import { Icon } from '@stage-labs/kit/react-native/icon';
import { Card } from '@stage-labs/kit/react-native/card';
import { ListView, ListViewItem } from '@stage-labs/kit/react-native/list-view';
import { ChatKitRenderer } from '@stage-labs/kit/react-native/chatkit-renderer';
import type {
  ListViewItemNode,
  ListViewNode,
  WidgetActionRegistry,
} from '@stage-labs/kit/chatkit';
import {
  settingsNavRow,
  settingsButtonRow,
  SETTINGS_NAV_PRESS,
  SETTINGS_BUTTON_PRESS,
} from '@stage-labs/views';
import { Box, Col } from '../layout';
import { flash } from '../../lib/toast';
import {
  getActiveAccount, getPrivateKey, canExportPrivateKey, type AccountRecord,
} from '../../lib/accounts';
import { deleteAccount, shortAddress, useActiveAccount } from '../../modules/messaging';
import { reloadApp } from '../AccountsManager.helpers';

interface SectionColors { fg: string; head: string; sub: string; border: string; rowBg: string }

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

export function AccountSecuritySection(
  { c, dark }: { c: SectionColors; danger?: string; dark: boolean },
): React.ReactElement | null {
  const epoch = useActiveAccount();
  const router = useRouter();
  const [rec, revealed, setRevealed] = useActiveRecord(epoch);

  if (!rec) return null;

  const rows: ListViewItemNode[] = [];
  if (canExportPrivateKey(rec) && !revealed) {
    rows.push(settingsNavRow({
      label: 'Export private key',
      iconStart: 'wallet',
      iconEnd: 'chevronDown',
      pressType: SETTINGS_BUTTON_PRESS,
      payload: { action: 'export' },
    }));
  }
  if (rec.type === 'smart') {
    rows.push(settingsNavRow({
      label: (rec.guardians ?? []).length ? 'Guardian recovery' : 'Set up guardian recovery',
      iconStart: 'userGroup',
      pressType: SETTINGS_NAV_PRESS,
      payload: { href: '/wallet/recovery' },
    }));
  }
  rows.push(settingsButtonRow({
    label: 'Remove account',
    iconStart: 'trash',
    clickType: SETTINGS_BUTTON_PRESS,
    payload: { action: 'remove' },
    danger: true,
  }));

  const node: ListViewNode = { type: 'ListView', children: rows };

  const registry: WidgetActionRegistry = {
    [SETTINGS_NAV_PRESS]: (action) => {
      const href = action.payload.href;
      if (typeof href === 'string') router.push(href);
    },
    [SETTINGS_BUTTON_PRESS]: (action) => {
      if (action.payload.action === 'export') confirmExport(rec, setRevealed);
      else if (action.payload.action === 'remove') confirmRemove(rec);
    },
  };

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
          <ChatKitRenderer node={node} registry={registry}/>
        </Card>
      </Box>
    </>
  );
}
