
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { AvatarView } from '@stage-labs/kit/react-native/avatar-view';
import type { ImageStyle, StyleProp } from 'react-native';
import { stampAvatarUrl, AVATAR_SIZES, type AvatarSize } from '@stage-labs/kit/avatar';
import { avatarRenderUrl } from '@stage-labs/client/profile/avatar';
import { avatarCacheKey } from '@stage-labs/client/identity/onchainProfile';
import { getPeerAvatar, usePeerProfiles } from '../lib/peerProfiles';

const FULLSCREEN_FETCH_PX = 512;

const SIZE_PX = AVATAR_SIZES;

interface Props {
  address?: string | null;
  imageUri?: string | null;
  size?: AvatarSize | number;
  square?: boolean;
  style?: StyleProp<ImageStyle>;
  onPress?: (fullUri: string | null) => void;
}

function resolveAvatarUri(
  address: string | null | undefined,
  imageUri: string | null | undefined,
  stampPx: number,
): string | null {
  if (imageUri?.trim()) return avatarRenderUrl(imageUri);
  if (!address) return null;
  return stampAvatarUrl(address, stampPx, avatarCacheKey(getPeerAvatar(address)));
}

export function Avatar({
  address, imageUri, size = 'md', square, style, onPress,
}: Props): React.ReactElement {
  usePeerProfiles([imageUri?.trim() ? null : address]);
  const px = typeof size === 'number' ? size : SIZE_PX[size];
  const uri = resolveAvatarUri(address, imageUri, px);

  const inner = <AvatarView src={uri} size={px} square={square} style={style} />;

  if (!onPress) return inner;

  const fullUri = resolveAvatarUri(address, imageUri, FULLSCREEN_FETCH_PX / 2);

  return (
    <Pressable onPress={() => { onPress(fullUri); }} hitSlop={8}>
      {inner}
    </Pressable>
  );
}

