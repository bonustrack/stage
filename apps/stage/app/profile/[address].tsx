import { useLocalSearchParams } from 'expo-router';
import { Text } from '@stage-labs/kit/react-native/text';
import { Col } from '../../components/layout';
import { ProfileScreen } from '../../components/ProfileScreen';
import { Spinner } from '../../components/Spinner';
import { useEffectiveColorScheme } from '../../lib/theme';
import { useResolvedHandle } from '../../lib/resolveHandle';

export default function UserProfileView(): React.ReactElement {
  const { address } = useLocalSearchParams<{ address: string }>();
  const resolved = useResolvedHandle(address);
  const dark = useEffectiveColorScheme() === 'dark';
  if (resolved.address) return <ProfileScreen address={resolved.address} variant="route" />;
  return (
    <Col surface="surface" flex={1} align="center" justify="center" padding={24}>
      {resolved.resolving
        ? <Spinner size={24} color={dark ? '#ffffff' : '#000000'} />
        : <Text role="secondary" textAlign="center">{`No account found for ${address ?? ''}.`}</Text>}
    </Col>
  );
}
