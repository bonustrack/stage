import { Alert } from 'react-native';
import { presentAlert } from './alertHost';

export function installAlertShim(): boolean {
  (Alert as { alert: typeof presentAlert }).alert = presentAlert;
  return true;
}
