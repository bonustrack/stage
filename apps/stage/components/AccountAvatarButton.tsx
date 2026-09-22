import { Image } from '@stage-labs/kit/react-native/image';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { useRouter } from 'expo-router';
import { Col } from './layout';
import { usePalette } from '../lib/theme';
import { usePeerProfiles, peerAvatarUrl } from '../lib/peerProfiles';
import { useActiveAccountRecord } from '../modules/messaging';
import { SETTINGS_ROUTE } from '../lib/routes';


export function AccountAvatar({ size }: { size: number }): React.ReactElement {
  const { border } = usePalette();
  const myAddress = useActiveAccountRecord()?.address ?? null;
  usePeerProfiles([myAddress]);
  if (myAddress === null) return <Col size={size} radius="full" background={border} />;
  return <Image src={peerAvatarUrl(myAddress, size)} size={size} radius="full" background={border} />;
}

export function AccountAvatarButton({ size = 28 }: { size?: number }): React.ReactElement {
  const router = useRouter();
  return (
    <Pressable accessibilityLabel="Settings" onPress={() => { router.navigate(SETTINGS_ROUTE); }} hitSlop={8}>
      <AccountAvatar size={size} />
    </Pressable>
  );
}
