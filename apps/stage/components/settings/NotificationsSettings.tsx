
import { useEffect, useState } from 'react';

import { Scroll as ScrollView } from '@stage-labs/kit/react-native/scroll';
import * as Notifications from 'expo-notifications';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Box, Col, WEB_EDGE_CONTENT, WEB_STACK_SCROLL, WEB_STACK_CONTENT_PAD } from '../layout';
import { Caption } from '@stage-labs/kit/react-native/caption';
import { usePalette } from '../../lib/theme';
import { setPushEnabled, usePushEnabled } from '../../lib/pushPref';
import { getOrCreateXmtpClient } from '../../modules/messaging';
import { registerPushWithDaemon, unregisterPushFromDaemon } from '../../lib/push';
import { StackHeader } from '../chrome/StackHeader';
import { SettingsList, SettingsToggleRow } from './rows';

export function NotificationsSettings(): React.ReactElement {
  const { text: fg } = usePalette();
  const insets = useSafeAreaInsets();
  const enabled = usePushEnabled();
  const [perm, setPerm] = useState<string>('undetermined');

  useEffect(() => {
    void Notifications.getPermissionsAsync().then(p => { setPerm(p.status); }).catch(() => undefined);
  }, []);

  const onToggle = (next: boolean): void => {
    void (async (): Promise<void> => {
      await setPushEnabled(next);
      try {
        const client = await getOrCreateXmtpClient('production');
        if (next) await registerPushWithDaemon(client);
        else await unregisterPushFromDaemon(client);
      } catch { }
      try { setPerm((await Notifications.getPermissionsAsync()).status); } catch { }
    })();
  };

  const permLabel = perm === 'granted'
    ? 'System notifications are allowed.'
    : perm === 'denied'
      ? 'Blocked in system settings — enable notifications for Metro in your OS settings.'
      : 'System permission will be requested when you enable push.';

  return (
    <Col surface="surface" flex={1}>
      <StackHeader title="Notifications"/>
      <ScrollView style={WEB_STACK_SCROLL} contentContainerStyle={[{ paddingBottom: 32 + insets.bottom }, WEB_EDGE_CONTENT, WEB_STACK_CONTENT_PAD]}>
        <Caption color={fg} style={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 }}>
          PUSH NOTIFICATIONS
        </Caption>
        <Box>
          <SettingsList>
            <SettingsToggleRow
              label="Push notifications"
              name="push"
              checked={enabled}
              description="Get notified about new messages even when Metro is closed."
              control="switch"
              onChange={onToggle}
            />
          </SettingsList>
        </Box>
        <Caption color={fg} style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          {permLabel}
        </Caption>
      </ScrollView>
    </Col>
  );
}
