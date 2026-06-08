/** Compact row of tappable social brand icons for the VIEW profile (snapshot.box
 *  style). Renders only the socials the user has set; each opens the canonical
 *  profile URL for its network. Read-only - the EDIT form (EditProfileModal) owns
 *  input. Handles are stored bare (no @ / no URL), so we normalise + build the
 *  link per network here. */

import { Linking } from 'react-native';
import { Pressable } from '@metro-labs/kit/pressable';
import { BrandIcon, type BrandIconName } from '@metro-labs/kit/icon';
import { Box } from './layout';
import type { Palette } from '../lib/theme';
import type { SnapshotProfile } from '@stage-labs/client/profile/snapshot';

type SocialKey = 'twitter' | 'github' | 'lens' | 'farcaster';

const ICON: Record<SocialKey, BrandIconName> = {
  twitter: 'brandX',
  github: 'brandGithub',
  lens: 'brandLens',
  farcaster: 'brandFarcaster',
};

/** Strip a leading @ and any surrounding whitespace from a stored handle. */
function clean(handle: string): string {
  return handle.trim().replace(/^@+/, '');
}

/** Build the canonical outbound URL for a network handle. Lens drops a trailing
 *  `.lens` for the hey.xyz path; Farcaster uses Warpcast. */
function urlFor(key: SocialKey, raw: string): string {
  const h = clean(raw);
  switch (key) {
    case 'twitter': return `https://x.com/${h}`;
    case 'github': return `https://github.com/${h}`;
    case 'lens': return `https://hey.xyz/u/${h.replace(/\.lens$/i, '')}`;
    case 'farcaster': return `https://warpcast.com/${h}`;
  }
}

export function ProfileSocialLinks({ profile, c }: {
  profile: SnapshotProfile | null | undefined;
  c: Palette;
}): React.ReactElement | null {
  if (!profile) return null;
  const keys: SocialKey[] = ['twitter', 'github', 'lens', 'farcaster'];
  const present = keys.filter(k => profile[k]?.trim());
  if (present.length === 0) return null;

  return (
    <Box style={{
      flexDirection: 'row', alignItems: 'center', gap: 18,
      marginHorizontal: 16, marginTop: 16,
    }}>
      {present.map(k => (
        <Pressable
          key={k}
          hitSlop={8}
          onPress={() => { void Linking.openURL(urlFor(k, profile[k] as string)); }}
          style={{ padding: 2 }}
        >
          <BrandIcon name={ICON[k]} size={22} color={c.text} />
        </Pressable>
      ))}
    </Box>
  );
}
