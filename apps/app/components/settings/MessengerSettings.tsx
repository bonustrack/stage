
import { useEffect, useState } from 'react';

import { Alert, DevSettings } from 'react-native';
import { Scroll as ScrollView } from '@stage-labs/kit/react-native/scroll';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Box, Col } from '../layout';
import { Caption } from '@stage-labs/kit/react-native/caption';
import { ViewHost } from '@stage-labs/kit/react-native/view-host';
import type {
  ListViewNode,
  PayloadHandlers,
} from '@stage-labs/kit/kit';
import {
  listRoot,
  settingsHeader,
  settingsValueRow,
  settingsButtonRow,
  SCREEN_BACK,
  SETTINGS_COPY,
  SETTINGS_BUTTON_PRESS,
} from '@stage-labs/views';
import { useRouter } from 'expo-router';
import { getOrCreateXmtpClient, resetXmtpClient, shortAddress, useActiveAccount } from '../../modules/messaging';
import { resetAccount } from '../../lib/wallet';
import { flash } from '../../lib/toast';
import { usePalette } from '../../lib/theme';
import { MessengerSessions } from './MessengerSessions';

export function MessengerSettings(): React.ReactElement {
  const router = useRouter();
  const { text: fg, link: head, border, toolbarBg } = usePalette();
  const sub = fg;
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
        if (!alive) return;
        setAddr(client.publicIdentity.identifier);
        setInbox(client.inboxId);
        setInstall(client.installationId ?? '');
      } catch { }
    })();
    return () => { alive = false; };
  }, [epoch]);

  const onResetIdentity = (): void => {
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
  };

  const rows = [
    addr ? settingsValueRow({ label: 'Your XMTP address', value: shortAddress(addr), copyType: SETTINGS_COPY, payload: { copy: addr } }) : null,
    inbox ? settingsValueRow({ label: 'Inbox id', value: inbox, copyType: SETTINGS_COPY, payload: { copy: inbox } }) : null,
    install ? settingsValueRow({ label: 'Installation id', value: shortAddress(install), copyType: SETTINGS_COPY, payload: { copy: install } }) : null,
  ].filter((r): r is NonNullable<typeof r> => r !== null);

  const accountNode: ListViewNode = { type: 'ListView', children: rows };

  const dangerNode = listRoot(
    settingsButtonRow({
      label: 'Reset XMTP identity',
      clickType: SETTINGS_BUTTON_PRESS,
      payload: { action: 'reset' },
      danger: true,
    }),
  );

  const headerNode = settingsHeader({
    title: 'Messenger',
    backColor: fg,
    titleColor: head,
    surface: toolbarBg,
    borderColor: border,
    safeTop: insets.top,
  });

  const actions: PayloadHandlers = {
    [SCREEN_BACK]: () => { router.back(); },
    [SETTINGS_COPY]: (payload) => {
      const value = payload.copy ?? payload.value;
      const label = payload.label;
      if (typeof value === 'string') {
        void Clipboard.setStringAsync(value);
        flash(`${typeof label === 'string' ? label : 'Value'} copied`);
      }
    },
    [SETTINGS_BUTTON_PRESS]: (payload) => {
      if (payload.action === 'reset') onResetIdentity();
    },
  };

  return (
    <Col surface="surface" flex={1}>
      <ViewHost node={headerNode} actions={actions}/>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 32 + insets.bottom }}>
        <Caption color={sub} style={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 }}>
          XMTP ACCOUNT
        </Caption>
        {rows.length ? (
          <Box>
            <ViewHost node={accountNode} actions={actions}/>
          </Box>
        ) : null}

        <MessengerSessions />

        <Box padding={{ top: 28 }}>
          <ViewHost node={dangerNode} actions={actions}/>
        </Box>
      </ScrollView>
    </Col>
  );
}
