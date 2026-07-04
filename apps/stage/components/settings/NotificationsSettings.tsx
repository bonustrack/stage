
import { useEffect, useState } from 'react';

import { Scroll as ScrollView } from '@stage-labs/kit/react-native/scroll';
import * as Notifications from 'expo-notifications';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Box, Col } from '../layout';
import { Caption } from '@stage-labs/kit/react-native/caption';
import { usePalette } from '../../lib/theme';
import { loadPushEnabled, setPushEnabled, subscribePushPref, isPushEnabledSync } from '../../lib/pushPref';
import { getOrCreateXmtpClient } from '../../modules/messaging';
import { registerPushWithDaemon, unregisterPushFromDaemon } from '../../lib/push';
import { SettingsHeader } from './SettingsHeader';
import { SettingsList, SettingsToggleRow } from './rows';

export function NotificationsSettings(): React.ReactElement {
  const { text: fg } = usePalette();
  const insets = useSafeAreaInsets();
  const [enabled, setEnabled] = useState(isPushEnabledSync());
  const [perm, setPerm] = useState<string>('undetermined');

  useEffect(() => {
    void loadPushEnabled().then(setEnabled);
    void Notifications.getPermissionsAsync().then(p => { setPerm(p.status); }).catch(() => undefined);
    return subscribePushPref(() => { setEnabled(isPushEnabledSync()); });
  }, []);

  const onToggle = (next: boolean): void => {
    setEnabled(next);
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
      <SettingsHeader title="Notifications"/>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 + insets.bottom }}>
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
