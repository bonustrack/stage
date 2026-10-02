import { useLocalSearchParams } from 'expo-router';
import { Text } from '@stage-labs/kit/react-native/text';
import { Col } from '../../components/layout';
import { ProfileScreen } from '../../components/ProfileScreen';
import { ChannelProfile } from '../../components/channel/ChannelProfile';
import { Spinner } from '@stage-labs/kit/react-native/spinner';
import { useEffectiveColorScheme } from '../../lib/theme';
import { useResolvedHandle } from '../../lib/resolveHandle';
import { profileKindOf } from '../../lib/conversationLink';

function UserProfile({ handle }: { handle: string }): React.ReactElement {
  const resolved = useResolvedHandle(handle);
  const dark = useEffectiveColorScheme() === 'dark';
  if (resolved.address) return <ProfileScreen address={resolved.address} />;
  return (
    <Col surface="surface" flex={1} align="center" justify="center" padding={24}>
      {resolved.resolving
        ? <Spinner size={24} color={dark ? '#ffffff' : '#000000'} />
        : <Text size="2xs" role="secondary" textAlign="center">{`No account found for ${handle}.`}</Text>}
    </Col>
  );
}

export default function ProfileView(): React.ReactElement {
  const { id } = useLocalSearchParams<{ id: string }>();
  const target = id ?? '';
  if (profileKindOf(target) === 'channel') return <ChannelProfile convId={target} />;
  return <UserProfile handle={target} />;
}
