import { Alert, Platform } from 'react-native';
import { presentAlert } from './alertHost';

export function installAlertShim(): boolean {
  if (Platform.OS !== 'web') return false;
  (Alert as { alert: typeof presentAlert }).alert = presentAlert;
  return true;
}
