
import { useEffect, useState } from 'react';

import { Scroll as ScrollView } from '@stage-labs/kit/react-native/scroll';
import * as Notifications from 'expo-notifications';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Box, Col } from '../layout';
import { Caption } from '@stage-labs/kit/react-native/caption';
import { ViewHost } from '@stage-labs/kit/react-native/view-host';
import type { PayloadHandlers } from '@stage-labs/kit/kit';
import {
  listRoot,
  settingsHeader,
  settingsToggleRow,
  SCREEN_BACK,
  SETTINGS_TOGGLE_CHANGE,
} from '@stage-labs/views';
import { useRouter } from 'expo-router';
import { usePalette } from '../../lib/theme';
import { loadPushEnabled, setPushEnabled, subscribePushPref, isPushEnabledSync } from '../../lib/pushPref';
import { getOrCreateXmtpClient } from '../../modules/messaging';
import { registerPushWithDaemon, unregisterPushFromDaemon } from '../../lib/push';

export function NotificationsSettings(): React.ReactElement {
  const router = useRouter();
  const { text: fg, link: head, border, toolbarBg } = usePalette();
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

  const node = listRoot(
    settingsToggleRow({
      label: 'Push notifications',
      name: 'push',
      checked: enabled,
      description: 'Get notified about new messages even when Metro is closed.',
      changeType: SETTINGS_TOGGLE_CHANGE,
      control: 'switch',
    }),
  );

  const headerNode = settingsHeader({
    title: 'Notifications',
    backColor: fg,
    titleColor: head,
    surface: toolbarBg,
    borderColor: border,
    safeTop: insets.top,
  });

  const actions: PayloadHandlers = {
    [SCREEN_BACK]: () => { router.back(); },
    [SETTINGS_TOGGLE_CHANGE]: (payload) => {
      const next = payload.push;
      if (typeof next === 'boolean') onToggle(next);
    },
  };

  return (
    <Col surface="surface" flex={1}>
      <ViewHost node={headerNode} actions={actions}/>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 + insets.bottom }}>
        <Caption color={sub} style={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 }}>
          PUSH NOTIFICATIONS
        </Caption>
        <Box>
          <ViewHost node={node} actions={actions}/>
        </Box>
        <Caption color={sub} style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          {permLabel}
        </Caption>
      </ScrollView>
    </Col>
  );
}
