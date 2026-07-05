
import { useLocalSearchParams } from 'expo-router';
import { ProfileScreen } from '../../components/ProfileScreen';

export default function UserProfileView(): React.ReactElement {
  const { address } = useLocalSearchParams<{ address: string }>();
  return <ProfileScreen address={address ?? ''} variant="route" />;
}
