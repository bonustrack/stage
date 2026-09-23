
import { useEffect, useState } from 'react';

import { Linking, Platform } from 'react-native';
import { Box } from '../layout';
import { Caption } from '@stage-labs/kit/react-native/caption';
import { usePalette } from '../../lib/theme';
import { setPushEnabled, usePushEnabled } from '../../lib/pushPref';
import { getOrCreateXmtpClient } from '../../modules/messaging';
import {
  getPushPermission, registerPushWithServer, requestPushPermission, unregisterPushFromServer,
} from '../../lib/pushRegister';
import { describePushStatus, usePushStatus } from '../../lib/pushStatus';
import { SettingsPage, SettingsSectionLabel } from './SettingsPage';
import { SettingsButtonRow, SettingsList, SettingsToggleRow } from './rows';

export function NotificationsSettings(): React.ReactElement {
  const { text: fg } = usePalette();
  const enabled = usePushEnabled();
  const [perm, setPerm] = useState<string>('undetermined');
  const status = usePushStatus();

  useEffect(() => {
    void getPushPermission().then(setPerm);
  }, []);

  const onToggle = (next: boolean): void => {
    void (async (): Promise<void> => {
      await setPushEnabled(next);
      if (next) setPerm(await requestPushPermission());
      try {
        const client = await getOrCreateXmtpClient('production');
        if (next) await registerPushWithServer(client);
        else await unregisterPushFromServer(client);
      } catch { }
      setPerm(await getPushPermission());
    })();
  };

  const permLabel = perm === 'granted'
    ? 'System notifications are allowed.'
    : perm === 'denied'
      ? (Platform.OS === 'web'
        ? 'Blocked in the browser. Allow notifications for this site to receive push.'
        : 'Blocked in system settings. Allow notifications for Stage to receive push.')
      : 'System permission will be requested when you enable push.';

  return (
    <SettingsPage title="Notifications">
      <SettingsSectionLabel top={20}>PUSH NOTIFICATIONS</SettingsSectionLabel>
      <Box>
        <SettingsList>
          <SettingsToggleRow
            label="Push notifications"
            name="push"
            checked={enabled}
            description="Get notified about new messages even when Stage is closed."
            control="switch"
            onChange={onToggle}
          />
        </SettingsList>
      </Box>
      <Caption color={fg} style={{ paddingHorizontal: 16, paddingTop: 12 }}>
        {permLabel}
      </Caption>
      <Caption color={fg} style={{ paddingHorizontal: 16, paddingTop: 8 }}>
        {describePushStatus(status)}
      </Caption>
      {perm === 'denied' && Platform.OS !== 'web' ? (
        <Box padding={{ top: 12 }}>
          <SettingsList>
            <SettingsButtonRow
              label="Open system settings"
              description="Allow notifications for Stage, then turn push off and on again."
              onPress={() => { void Linking.openSettings(); }}
            />
          </SettingsList>
        </Box>
      ) : null}
    </SettingsPage>
  );
}
