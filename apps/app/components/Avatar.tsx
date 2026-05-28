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

import { Image, View } from 'react-native';
import type { ImageStyle, StyleProp } from 'react-native';
import { stampBoxAvatarUrl } from '../lib/xmtp';
import { avatarRenderUrl } from '@metro-labs/client/profile/snapshot';

export type AvatarSize = 'sm' | 'md' | 'lg';

const SIZE_PX: Record<AvatarSize, number> = { sm: 24, md: 32, lg: 64 };

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
}

export function Avatar({
  address, imageUri, size = 'md', cacheBuster, style,
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
  else if (address) {
    const cb = cacheBuster === undefined ? undefined : String(cacheBuster);
    uri = stampBoxAvatarUrl(address, fetchPx, cb);
  }

  if (!uri) {
    return <View style={[baseStyle, style]} />;
  }
  return <Image source={{ uri }} style={[baseStyle, style]} />;
}

export const AVATAR_SIZES = SIZE_PX;
