import { Platform } from 'react-native';
import { SettingsMenu } from '../../components/settings/SettingsHub';

export default function SettingsRoute(): React.ReactElement | null {
  return Platform.OS === 'web' ? <SettingsMenu /> : null;
}
