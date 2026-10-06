import { useEffect, useState } from 'react';
import { Linking, Platform } from 'react-native';
import { setPushEnabled, usePushEnabled } from '../../lib/pushPref';
import { getOrCreateXmtpClient } from '../../lib/xmtp.client';
import {
  getPushPermission, isPushSupported, registerPushWithServer, requestPushPermission, unregisterPushFromServer,
} from '../../lib/pushRegister';
import { describePushStatus, usePushStatus } from '../../lib/pushStatus';
import { SettingsButtonRow, SettingsGroup, SettingsPage, SettingsToggleRow } from './SettingsPage';
import { capabilities } from '../../lib/capabilities';
import { report } from '../../lib/errorPolicy';

function permissionLabel(perm: string): string {
  if (perm === 'granted') return 'System notifications are allowed.';
  if (perm !== 'denied') return 'System permission will be requested when you enable push.';
  return Platform.OS === 'web'
    ? 'Blocked in the browser. Allow notifications for this site to receive push.'
    : 'Blocked in system settings. Allow notifications for Stage to receive push.';
}

export async function applyPush(next: boolean): Promise<void> {
  if (!isPushSupported()) return;
  await setPushEnabled(next);
  if (next) await requestPushPermission();
  try {
    const client = await getOrCreateXmtpClient('production');
    if (next) await registerPushWithServer(client);
    else await unregisterPushFromServer(client);
  } catch (err) {
    report('settings.push', err);
    capabilities.toast('Could not update notifications. Try again.');
  }
}

function usePushToggle(): { enabled: boolean; perm: string; onToggle: (next: boolean) => void } {
  const enabled = usePushEnabled();
  const [perm, setPerm] = useState<string>('undetermined');
  useEffect(() => {
    void getPushPermission().then(setPerm);
  }, []);
  const onToggle = (next: boolean): void => {
    void applyPush(next).then(async () => { setPerm(await getPushPermission()); });
  };
  return { enabled, perm, onToggle };
}

export function NotificationsSettings(): React.ReactElement {
  const { enabled, perm, onToggle } = usePushToggle();
  const status = usePushStatus();
  const supported = isPushSupported();
  return (
    <SettingsPage title="Notifications">
      <SettingsGroup title="Push" footnote={supported ? `${permissionLabel(perm)} ${describePushStatus(status)}` : 'Push notifications are unavailable in this browser.'}>
        <SettingsToggleRow
          label="Push notifications"
          name="push"
          checked={enabled && supported}
          disabled={!supported}
          description={supported ? 'Get notified about new messages even when Stage is closed.' : undefined}
          onChange={onToggle}
        />
      </SettingsGroup>
      {perm === 'denied' && Platform.OS !== 'web' ? (
        <SettingsGroup>
          <SettingsButtonRow
            label="Open system settings"
            description="Allow notifications for Stage, then turn push off and on again."
            onPress={() => { void Linking.openSettings(); }}
          />
        </SettingsGroup>
      ) : null}
    </SettingsPage>
  );
}
