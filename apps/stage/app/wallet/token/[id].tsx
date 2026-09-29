import { Redirect } from 'expo-router';

export default function LegacyTokenRedirect(): React.ReactElement {
  return <Redirect href="/wallet" />;
}
