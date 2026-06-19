/** @file Profile route for an Ethereum address rendering the shared ProfileScreen (own-vs-peer view) opened from any avatar tap. */

import { useLocalSearchParams } from 'expo-router';
import { ProfileScreen } from '../../components/ProfileScreen';

/** Route screen showing a user profile for the address in the path. */
export default function UserProfileView(): React.ReactElement {
  const { address } = useLocalSearchParams<{ address: string }>();
  return <ProfileScreen address={address ?? ''} variant="route" />;
}
