/** @file Unified mobile avatar with three canonical sizes, rendering a custom image, else a stamp.fyi address identicon, else a solid placeholder circle. */

import { Pressable } from '@metro-labs/kit/pressable';
import { AvatarView } from '@metro-labs/kit/avatar-view';
import type { ImageStyle, StyleProp } from 'react-native';
import { stampAvatarUrl, AVATAR_SIZES, type AvatarSize } from '@metro-labs/kit/avatar';
import { avatarRenderUrl } from '@stage-labs/client/profile/snapshot';

/** Fetch size (px) requested when an avatar is opened large — independent of the displayed size so the fullscreen viewer gets a crisp image. */
const FULLSCREEN_FETCH_PX = 512;

const SIZE_PX = AVATAR_SIZES;

interface Props {
  /** Eth address used for the stamp.fyi identicon fallback. */
  address?: string | null;
  /** Custom uploaded avatar URI (ipfs:// or https://). Takes precedence over `address` when set + non-empty. */
  imageUri?: string | null;
  /** Either a canonical preset (`sm`/`md`/`lg`) or an explicit pixel size for one-off larger/smaller call sites that don't map onto a preset. */
  size?: AvatarSize | number;
  /** Optional cache-buster appended to the stamp URL to force a refetch. */
  cacheBuster?: number | string;
  /** Render as a rounded SQUARE instead of a circle. Used for group/channel avatars so they read as distinct from circular user avatars at a glance. */
  square?: boolean;
  /** Extra style overrides (background colour, ring, etc.). */
  style?: StyleProp<ImageStyle>;
  /** Tap handler given a high-res image URI (fullscreen-sized) or null for the placeholder; wraps the avatar in a Pressable and centralizes URL resolution. */
  onPress?: (fullUri: string | null) => void;
}

/** Resolve a displayable avatar URI at the given fetch/stamp pixel sizes, or null. */
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

/** Renders a user or group avatar from a custom image, stamp.fyi identicon, or placeholder circle. */
export function Avatar({
  address, imageUri, size = 'md', cacheBuster, square, style, onPress,
}: Props): React.ReactElement {
  const px = typeof size === 'number' ? size : SIZE_PX[size];
  /** stamp.fyi serves doubled-pixel WebPs by convention — keeps retina rows crisp without bumping the displayed dimension. */
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

