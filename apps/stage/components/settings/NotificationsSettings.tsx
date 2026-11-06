import { useEffect, useState } from 'react';
import { Linking, Platform } from 'react-native';
import { getPushPermission, isPushSupported } from '../../lib/pushNotify';
import { describePushStatus, usePushStatus } from '../../lib/pushStatus';
import { SettingsButtonRow, SettingsGroup, SettingsPage } from './SettingsPage';
import { PUSH_UNAVAILABLE, PushToggleRow } from './PushToggleRow';

function permissionLabel(perm: string): string {
  if (perm === 'granted') return 'System notifications are allowed.';
  if (perm !== 'denied') return 'System permission will be requested when you enable push.';
  return Platform.OS === 'web'
    ? 'Blocked in the browser. Allow notifications for this site to receive push.'
    : 'Blocked in system settings. Allow notifications for Stage to receive push.';
}

function usePushPermission(): { perm: string; refresh: () => void } {
  const [perm, setPerm] = useState<string>('undetermined');
  const refresh = (): void => {
    void getPushPermission().then(setPerm);
  };
  useEffect(refresh, []);
  return { perm, refresh };
}

export function NotificationsSettings(): React.ReactElement {
  const { perm, refresh } = usePushPermission();
  const status = usePushStatus();
  const supported = isPushSupported();
  return (
    <SettingsPage section="notifications">
      <SettingsGroup title="Push" footnote={supported ? `${permissionLabel(perm)} ${describePushStatus(status)}` : PUSH_UNAVAILABLE}>
        <PushToggleRow about="Get notified about new messages even when Stage is closed." onToggled={refresh} />
      </SettingsGroup>
      {perm === 'denied' && Platform.OS !== 'web' ? (
        <SettingsGroup>
          <SettingsButtonRow
            label="Open system settings"
            description="Allow notifications for Stage, then turn push off and on again."
            onPress={() => {
              void Linking.openSettings();
            }}
          />
        </SettingsGroup>
      ) : null}
    </SettingsPage>
  );
}
