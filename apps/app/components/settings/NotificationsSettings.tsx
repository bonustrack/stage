
import { useEffect, useState } from 'react';

import { Scroll as ScrollView } from '@stage-labs/kit/react-native/scroll';
import * as Notifications from 'expo-notifications';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Box, Col } from '../layout';
import { Caption } from '@stage-labs/kit/react-native/caption';
import { ChatKitRenderer } from '@stage-labs/kit/react-native/chatkit-renderer';
import type {
  ListViewNode,
  WidgetActionRegistry,
} from '@stage-labs/kit/chatkit';
import {
  settingsToggleRow,
  SETTINGS_TOGGLE_CHANGE,
} from '@stage-labs/views';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { SystemHeader } from '../system/SystemHeader';
import { loadPushEnabled, setPushEnabled, subscribePushPref, isPushEnabledSync } from '../../lib/pushPref';
import { getOrCreateXmtpClient } from '../../modules/messaging';
import { registerPushWithDaemon, unregisterPushFromDaemon } from '../../lib/push';

export function NotificationsSettings(): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const { text: fg, link: head, border } = usePalette();
  const sub = fg;
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

  const node: ListViewNode = {
    type: 'ListView',
    children: [
      settingsToggleRow({
        label: 'Push notifications',
        name: 'push',
        checked: enabled,
        description: 'Get notified about new messages even when Metro is closed.',
        changeType: SETTINGS_TOGGLE_CHANGE,
      }),
    ],
  };

  const registry: WidgetActionRegistry = {
    [SETTINGS_TOGGLE_CHANGE]: (action) => {
      const next = action.payload.push;
      if (typeof next === 'boolean') onToggle(next);
    },
  };

  return (
    <Col surface="surface" flex={1}>
      <SystemHeader title="Notifications" dark={dark} fg={fg} head={head} border={border}/>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 + insets.bottom }}>
        <Caption color={sub} style={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 }}>
          PUSH NOTIFICATIONS
        </Caption>
        <Box>
          <ChatKitRenderer node={node} registry={registry}/>
        </Box>
        <Caption color={sub} style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          {permLabel}
        </Caption>
      </ScrollView>
    </Col>
  );
}
