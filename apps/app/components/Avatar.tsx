/** Unified avatar component for the mobile app.
 *
 *  Three canonical sizes (tailwind-style abbreviations):
 *    - `sm` = 24 px (bubble row avatars, conversation topnav)
 *    - `md` = 32 px (channels list rows, search results, wallet card chip)
 *    - `lg` = 64 px (profile page, /user/[address], DM intro banner)
 *
 *  Rendering priority:
 *    1. `imageUri` (custom Snapshot-profile avatar, group-uploaded image) →
 *       routed through `avatarRenderUrl` so ipfs:// + relative paths work.
 *    2. `address` → `cdn.stamp.fyi` identicon, with an optional cache-buster
 *       so a profile-avatar change cracks the browser cache.
 *    3. Neither → solid placeholder circle (same colour as a loading row).
 *
 *  Replaces ~10 ad-hoc `<Image source={{ uri: stampBoxAvatarUrl(...) }} />`
 *  call sites that all picked their own size constants and forgot the
 *  cache-buster half the time. */

import { Image, Pressable, View } from 'react-native';
import type { ImageStyle, StyleProp } from 'react-native';
import { stampAvatarUrl, AVATAR_SIZES, type AvatarSize } from '@metro-labs/kit/avatar';
import { avatarRenderUrl } from '@metro-labs/client/profile/snapshot';

/** Fetch size (px) requested when an avatar is opened large — independent of
 *  the displayed size so the fullscreen viewer gets a crisp image. */
const FULLSCREEN_FETCH_PX = 512;

export type { AvatarSize };
export { AVATAR_SIZES };

const SIZE_PX = AVATAR_SIZES;

interface Props {
  /** Eth address used for the stamp.fyi identicon fallback. */
  address?: string | null;
  /** Custom uploaded avatar URI (ipfs:// or https://). Takes precedence
   *  over `address` when set + non-empty. */
  imageUri?: string | null;
  size?: AvatarSize;
  /** Cache-buster appended to the stamp URL. Pass `getPeerAvatarCb(address)`
   *  for peer rows so an avatar update invalidates the cached image. */
  cacheBuster?: number | string;
  /** Extra style overrides (background colour, ring, etc.). */
  style?: StyleProp<ImageStyle>;
  /** Tap handler. Receives a HIGH-RES resolved image URI (sized for the
   *  fullscreen viewer), or null when there's no image (placeholder circle).
   *  When set, the avatar is wrapped in a Pressable. Keeps the avatar-URL
   *  resolution in one place so call sites don't re-derive stamp/IPFS URLs. */
  onPress?: (fullUri: string | null) => void;
}

export function Avatar({
  address, imageUri, size = 'md', cacheBuster, style, onPress,
}: Props): React.ReactElement {
  const px = SIZE_PX[size];
  const placeholderBg = '#282a2d';
  /** stamp.fyi serves doubled-pixel WebPs by convention — keeps retina rows
   *  crisp without bumping the displayed dimension. */
  const fetchPx = px * 2;
  const baseStyle: StyleProp<ImageStyle> = {
    width: px, height: px, borderRadius: 999, backgroundColor: placeholderBg,
  };
  let uri: string | null = null;
  if (imageUri && imageUri.trim()) uri = avatarRenderUrl(address ?? '', imageUri, fetchPx);
  else if (address) uri = stampAvatarUrl(address, px, cacheBuster);

  const inner = uri
    ? <Image source={{ uri }} style={[baseStyle, style]} />
    : <View style={[baseStyle, style]} />;

  if (!onPress) return inner;

  /** Resolve a larger URI for the fullscreen viewer than the displayed one. */
  let fullUri: string | null = null;
  if (imageUri && imageUri.trim()) fullUri = avatarRenderUrl(address ?? '', imageUri, FULLSCREEN_FETCH_PX);
  else if (address) fullUri = stampAvatarUrl(address, FULLSCREEN_FETCH_PX / 2, cacheBuster);

  return (
    <Pressable onPress={() => onPress(fullUri)} hitSlop={8}>
      {inner}
    </Pressable>
  );
}

