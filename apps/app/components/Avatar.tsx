
import { Pressable } from '@stage-labs/kit/pressable';
import { AvatarView } from '@stage-labs/kit/avatar-view';
import type { ImageStyle, StyleProp } from 'react-native';
import { stampAvatarUrl, AVATAR_SIZES, type AvatarSize } from '@stage-labs/kit/avatar';
import { avatarRenderUrl } from '@stage-labs/client/profile/snapshot';

const FULLSCREEN_FETCH_PX = 512;

const SIZE_PX = AVATAR_SIZES;

interface Props {
  address?: string | null;
  imageUri?: string | null;
  size?: AvatarSize | number;
  cacheBuster?: number | string;
  square?: boolean;
  style?: StyleProp<ImageStyle>;
  onPress?: (fullUri: string | null) => void;
}

function resolveAvatarUri(
  address: string | null | undefined,
  imageUri: string | null | undefined,
  renderPx: number,
  stampPx: number,
  cacheBuster?: number | string,
): string | null {
  if (imageUri?.trim()) return avatarRenderUrl(address ?? '', imageUri, renderPx);
  if (address) return stampAvatarUrl(address, stampPx, cacheBuster);
  return null;
}

export function Avatar({
  address, imageUri, size = 'md', cacheBuster, square, style, onPress,
}: Props): React.ReactElement {
  const px = typeof size === 'number' ? size : SIZE_PX[size];
  const fetchPx = px * 2;
  const uri = resolveAvatarUri(address, imageUri, fetchPx, px, cacheBuster);

  const inner = <AvatarView src={uri} size={px} square={square} style={style} />;

  if (!onPress) return inner;

  const fullUri = resolveAvatarUri(
    address, imageUri, FULLSCREEN_FETCH_PX, FULLSCREEN_FETCH_PX / 2, cacheBuster,
  );

  return (
    <Pressable onPress={() => { onPress(fullUri); }} hitSlop={8}>
      {inner}
    </Pressable>
  );
}

