
import { useState } from 'react';
import { Alert } from 'react-native';
import { resetForOnboarding } from '../../lib/wallet';
import { resetEverything } from '../../lib/resetEverything';
import { SettingsButtonRow, SettingsList } from './rows';

const RESET_DESC =
  'Wipe all local accounts, wallet keys, the recovery phrase and XMTP message stores, then return to onboarding.';
const NUKE_DESC =
  'Full nuke: everything above PLUS all settings, pins, read markers and cached data. Restarts the app as a fresh install.';
const DEV_RESET_DESC = `${RESET_DESC} Cannot be undone.`;
const DEV_NUKE_DESC =
  'Full nuke: everything above PLUS all settings, preferences, pins, read markers and cached data. Restarts the app as a fresh install. Cannot be undone.';

export function DangerZone({ dev = false }: { dev?: boolean }): React.ReactElement {
  const [resetting, setResetting] = useState(false);
  const [nuking, setNuking] = useState(false);
  const suffix = dev ? ' (dev)' : '';
  return (
    <SettingsList>
      <SettingsButtonRow
        label={resetting ? 'Resetting…' : `Reset accounts${suffix}`}
        description={dev ? DEV_RESET_DESC : RESET_DESC}
        iconStart="refresh"
        danger
        onPress={() => { onReset(setResetting); }}
      />
      <SettingsButtonRow
        label={nuking ? 'Erasing…' : `Reset everything${suffix}`}
        description={dev ? DEV_NUKE_DESC : NUKE_DESC}
        iconStart="trash"
        danger
        onPress={() => { onNuke(setNuking); }}
      />
    </SettingsList>
  );
}

function onReset(setResetting: (v: boolean) => void): void {
  Alert.alert(
    'Reset accounts',
    'Wipes ALL local accounts, wallet keys, the recovery phrase, and every XMTP message store on this device, then returns to onboarding. This cannot be undone.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: () => {
          setResetting(true);
          void resetForOnboarding()
            .catch(() => { Alert.alert('Reset failed', 'Could not clear account state.'); })
            .finally(() => { setResetting(false); });
        },
      },
    ],
  );
}

function onNuke(setNuking: (v: boolean) => void): void {
  Alert.alert(
    'Reset everything',
    'Erases EVERYTHING on this device: accounts, wallet keys, the recovery phrase, every XMTP message store, and ALL settings, preferences, pins, read markers and cached data. The app restarts as a fresh install and drops you into onboarding. This cannot be undone.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Erase everything',
        style: 'destructive',
        onPress: () => {
          setNuking(true);
          void resetEverything()
            .catch(() => { setNuking(false); Alert.alert('Reset failed', 'Could not wipe local state.'); });
        },
      },
    ],
  );
}
