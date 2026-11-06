import { Image } from '@stage-labs/kit/react-native/image';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { useRouter } from 'expo-router';
import { usePalette } from '../lib/theme';
import { usePeerProfiles, peerAvatarUrl } from '../lib/peerProfiles';
import { useActiveAccountRecord } from '../lib/messaging/account';
import { PAGES } from './tabs/pages';
import { Column } from './layout';

export function AccountAvatar({ size }: { size: number }): React.ReactElement {
  const { border } = usePalette();
  const myAddress = useActiveAccountRecord()?.address ?? null;
  usePeerProfiles([myAddress]);
  if (myAddress === null) return <Column size={size} radius="full" background={border} />;
  return <Image fit="cover" url={peerAvatarUrl(myAddress, size)} size={size} radius="full" background={border} />;
}

export function AccountAvatarButton({ size = 28 }: { size?: number }): React.ReactElement {
  const router = useRouter();
  return (
    <Pressable
      accessibilityLabel="Settings"
      onPress={() => {
        router.navigate(PAGES.settings.href);
      }}
      hitSlop={8}
    >
      <AccountAvatar size={size} />
    </Pressable>
  );
}
