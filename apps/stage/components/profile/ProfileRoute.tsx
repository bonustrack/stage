import { useLocalSearchParams } from 'expo-router';
import { Text } from '@stage-labs/kit/react-native/text';
import { ProfileScreen } from './ProfileScreen';
import { ChannelProfile } from '../channel/ChannelProfile';
import { Spinner } from '@stage-labs/kit/react-native/spinner';
import { useEffectiveColorScheme } from '../../lib/theme';
import { useResolvedHandle } from '../../lib/resolveHandle';
import { profileKindOf } from '@stage-labs/client/routing/handles';
import { Column } from '../layout';

function UserProfile({ handle }: { handle: string }): React.ReactElement {
  const resolved = useResolvedHandle(handle);
  const dark = useEffectiveColorScheme() === 'dark';
  if (resolved.address) return <ProfileScreen address={resolved.address} />;
  return (
    <Column surface="surface" weight={1} align="center" justify="center" padding={24}>
      {resolved.resolving ? (
        <Spinner size={24} color={dark ? '#ffffff' : '#000000'} />
      ) : (
        <Text size="xs" color="secondary" textAlign="center">{`No account found for ${handle}.`}</Text>
      )}
    </Column>
  );
}

export function ProfileRoute(): React.ReactElement {
  const { id } = useLocalSearchParams<{ id: string }>();
  const target = id ?? '';
  if (profileKindOf(target) === 'channel') return <ChannelProfile convId={target} />;
  return <UserProfile handle={target} />;
}
