/** Profile view for an Ethereum address, opened from any avatar tap in the
 *  messenger. Renders the shared ProfileScreen, which decides own-vs-other by
 *  comparing this address to the active account: a peer gets Message + Send, and
 *  your own address (e.g. tapping your own avatar) gets the edit overflow menu —
 *  identical to the footer Profile tab. */

import { useLocalSearchParams } from 'expo-router';
import { ProfileScreen } from '../../components/ProfileScreen';

/** Route screen showing a user profile for the address in the path. */
export default function UserProfileView(): React.ReactElement {
  const { address } = useLocalSearchParams<{ address: string }>();
  return <ProfileScreen address={address ?? ''} variant="route" />;
}
