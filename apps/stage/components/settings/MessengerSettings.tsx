
import { useEffect, useState } from 'react';

import { Alert, DevSettings } from 'react-native';
import { Scroll as ScrollView } from '@stage-labs/kit/react-native/scroll';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Box, Col, WEB_EDGE_SCROLL, WEB_EDGE_CONTENT } from '../layout';
import { Caption } from '@stage-labs/kit/react-native/caption';
import {
  getOrCreateXmtpClient, resetXmtpClient, selfEthAddress, shortAddress, useActiveAccount,
} from '../../modules/messaging';
import { resetAccount } from '../../lib/wallet';
import { flash } from '../../lib/toast';
import { usePalette } from '../../lib/theme';
import { MessengerSessions } from './MessengerSessions';
import { SettingsHeader } from './SettingsHeader';
import { SettingsButtonRow, SettingsList, SettingsValueRow } from './rows';

function onResetIdentity(): void {
  Alert.alert(
    'Reset XMTP identity',
    'This wipes the local wallet + XMTP database. You will get a fresh inbox on next launch. Existing conversations on this device will become unreachable.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: () => {
          void (async (): Promise<void> => {
            await resetXmtpClient();
            await resetAccount();
            DevSettings.reload?.();
          })();
        } },
    ],
  );
}

function copyValue(label: string, value: string): void {
  void Clipboard.setStringAsync(value);
  flash(`${label} copied`);
}

export function MessengerSettings(): React.ReactElement {
  const { text: fg } = usePalette();
  const insets = useSafeAreaInsets();
  const epoch = useActiveAccount();
  const [addr, setAddr] = useState('');
  const [inbox, setInbox] = useState('');
  const [install, setInstall] = useState('');

  useEffect(() => {
    let alive = true;
    void (async (): Promise<void> => {
      try {
        const client = await getOrCreateXmtpClient('production');
        const address = await selfEthAddress();
        if (!alive) return;
        setAddr(address ?? '');
        setInbox(client.inboxId);
        setInstall(client.installationId ?? '');
      } catch { }
    })();
    return () => { alive = false; };
  }, [epoch]);

  const hasRows = addr !== '' || inbox !== '' || install !== '';

  return (
    <Col surface="surface" flex={1}>
      <SettingsHeader title="Messenger"/>
      <ScrollView style={[{ flex: 1 }, WEB_EDGE_SCROLL]} contentContainerStyle={[{ paddingBottom: 32 + insets.bottom }, WEB_EDGE_CONTENT]}>
        <Caption color={fg} style={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 }}>
          XMTP ACCOUNT
        </Caption>
        {hasRows ? (
          <Box>
            <SettingsList>
              {addr ? (
                <SettingsValueRow
                  label="Your XMTP address"
                  value={shortAddress(addr)}
                  onPress={() => { copyValue('Your XMTP address', addr); }}
                />
              ) : null}
              {inbox ? (
                <SettingsValueRow
                  label="Inbox id"
                  value={inbox}
                  onPress={() => { copyValue('Inbox id', inbox); }}
                />
              ) : null}
              {install ? (
                <SettingsValueRow
                  label="Installation id"
                  value={shortAddress(install)}
                  onPress={() => { copyValue('Installation id', install); }}
                />
              ) : null}
            </SettingsList>
          </Box>
        ) : null}

        <MessengerSessions />

        <Box padding={{ top: 28 }}>
          <SettingsList>
            <SettingsButtonRow
              label="Reset XMTP identity"
              danger
              onPress={onResetIdentity}
            />
          </SettingsList>
        </Box>
      </ScrollView>
    </Col>
  );
}
