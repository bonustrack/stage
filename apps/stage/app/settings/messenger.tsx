import { Redirect } from 'expo-router';

export default function MessengerSettingsRedirect(): React.ReactElement {
  return <Redirect href="/settings/devices" />;
}
