
import { useEffect, useState } from 'react';

import { Switch } from 'react-native';
import { Scroll as ScrollView } from '@stage-labs/kit/react-native/scroll';
import * as Notifications from 'expo-notifications';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Box, Col, Row } from '../layout';
import { Text } from '@stage-labs/kit/react-native/text';
import { Caption } from '@stage-labs/kit/react-native/caption';
import { useBlockRadius, useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { SystemHeader } from '../system/SystemHeader';
import { loadPushEnabled, setPushEnabled, subscribePushPref, isPushEnabledSync } from '../../lib/pushPref';
import { getOrCreateXmtpClient } from '../../modules/messaging';
import { registerPushWithDaemon, unregisterPushFromDaemon } from '../../lib/push';

export function NotificationsSettings(): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const { text: fg, link: head, border } = usePalette();
  const sub = fg;
  const insets = useSafeAreaInsets();
  const blockRadius = useBlockRadius();
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
      <SystemHeader title="Notifications" dark={dark} fg={fg} head={head} border={border}/>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 + insets.bottom }}>
        <Caption color={sub} style={{ paddingHorizontal: 16, paddingTop: 20 }}>
          PUSH NOTIFICATIONS
        </Caption>
        <Box radius={blockRadius} surface="raised" padding={14} margin={{ x: 16, top: 8 }}
          style={{ borderWidth: 1, borderColor: border }}
>
          <Row align="center" gap={12}>
            <Col minWidth={0} flex={1}>
              <Text weight="semibold" size="md" color={head}>Push notifications</Text>
              <Caption color={sub} style={{ marginTop: 2 }}>
                Get notified about new messages even when Metro is closed.
              </Caption>
            </Col>
            <Switch value={enabled} onValueChange={onToggle}/>
          </Row>
        </Box>
        <Caption color={sub} style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          {permLabel}
        </Caption>
      </ScrollView>
    </Col>
  );
}
