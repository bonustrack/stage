
import { Alert } from 'react-native';
import { resetForOnboarding } from '../../lib/wallet';
import { resetEverything } from '../../lib/resetEverything';

export function onReset(setResetting: (v: boolean) => void): void {
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

export function onNuke(setNuking: (v: boolean) => void): void {
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
