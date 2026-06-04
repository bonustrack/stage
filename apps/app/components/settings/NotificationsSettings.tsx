/** Settings → Notifications — enable / disable PUSH notifications.
 *
 *  A single Switch wired to the device-local push preference (lib/pushPref):
 *   - ON  → persist the preference, request OS notification permission, and
 *           register this device's push token with the daemon
 *           (`registerPushWithDaemon`, which now respects the preference).
 *   - OFF → persist the preference + tell the daemon to drop this device's
 *           token (`unregisterPushFromDaemon`) so background pushes stop.
 *
 *  Reflects the current OS permission state below the toggle so the user knows
 *  if the system has blocked notifications regardless of the in-app preference. */

import { useEffect, useState } from 'react';
import { ScrollView, Switch } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Box, Col, Row } from '../layout';
import { Text } from '@metro-labs/kit/text';
import { useBlockRadius, useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { SystemHeader } from '../system/SystemHeader';
import { loadPushEnabled, setPushEnabled, subscribePushPref, isPushEnabledSync } from '../../lib/pushPref';
import { getOrCreateXmtpClient } from '../../lib/xmtp';
import { registerPushWithDaemon, unregisterPushFromDaemon } from '../../lib/push';

export function NotificationsSettings(): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const { text: fg, link: head, bg, border } = usePalette();
  const sub = fg;
  const rowBg = border;
  const insets = useSafeAreaInsets();
  const blockRadius = useBlockRadius();
  const [enabled, setEnabled] = useState(isPushEnabledSync());
  const [perm, setPerm] = useState<string>('undetermined');

  useEffect(() => {
    void loadPushEnabled().then(setEnabled);
    void Notifications.getPermissionsAsync().then(p => setPerm(p.status)).catch(() => undefined);
    return subscribePushPref(() => setEnabled(isPushEnabledSync()));
  }, []);

  const onToggle = (next: boolean): void => {
    setEnabled(next); // optimistic
    void (async (): Promise<void> => {
      await setPushEnabled(next);
      try {
        const client = await getOrCreateXmtpClient('production');
        if (next) await registerPushWithDaemon(client);
        else await unregisterPushFromDaemon(client);
      } catch { /* best-effort — preference is already persisted */ }
      try { setPerm((await Notifications.getPermissionsAsync()).status); } catch { /* ignore */ }
    })();
  };

  const permLabel = perm === 'granted'
    ? 'System notifications are allowed.'
    : perm === 'denied'
      ? 'Blocked in system settings — enable notifications for Metro in your OS settings.'
      : 'System permission will be requested when you enable push.';

  return (
    <Box style={{ flex: 1, backgroundColor: bg, paddingTop: insets.top }}>
      <SystemHeader title="Notifications" dark={dark} fg={fg} head={head} border={border} />
      <ScrollView contentContainerStyle={{ paddingBottom: 32 + insets.bottom }}>
        <Text style={{ color: sub, fontSize: 13, paddingHorizontal: 16, paddingTop: 20, fontFamily: 'Calibre-Medium' }}>
          PUSH NOTIFICATIONS
        </Text>
        <Box
          style={{
            marginHorizontal: 16, marginTop: 8, padding: 14, borderRadius: blockRadius,
            backgroundColor: rowBg, borderWidth: 1, borderColor: border,
          }}
        >
          <Row align="center" gap={12}>
            <Col flex={1} style={{ minWidth: 0 }}>
              <Text style={{ color: head, fontSize: 16, fontFamily: 'Calibre-Semibold' }}>Push notifications</Text>
              <Text style={{ color: sub, fontSize: 13, marginTop: 2, fontFamily: 'Calibre-Medium' }}>
                Get notified about new messages even when Metro is closed.
              </Text>
            </Col>
            <Switch value={enabled} onValueChange={onToggle} />
          </Row>
        </Box>
        <Text style={{ color: sub, fontSize: 13, paddingHorizontal: 16, paddingTop: 12, fontFamily: 'Calibre-Medium' }}>
          {permLabel}
        </Text>
      </ScrollView>
    </Box>
  );
}
