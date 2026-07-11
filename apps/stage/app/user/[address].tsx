
import { Redirect, useLocalSearchParams } from 'expo-router';

export default function LegacyUserRedirect(): React.ReactElement {
  const { address } = useLocalSearchParams<{ address: string }>();
  return <Redirect href={{ pathname: '/profile/[address]', params: { address: address ?? '' } }} />;
}
