import InCallManager from 'react-native-incall-manager';

export function startRingtone(): () => void {
  InCallManager.startRingtone('_BUNDLE_', [0, 350, 1_700], 'default', 0);
  return () => { InCallManager.stopRingtone(); };
}
