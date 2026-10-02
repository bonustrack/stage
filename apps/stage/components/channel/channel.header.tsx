import type { ReactNode } from 'react';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Image } from '@stage-labs/kit/react-native/image';
import { Text } from '@stage-labs/kit/react-native/text';
import { Box, PAGE_GUTTER } from '../layout';
import { Eyebrow } from '../Eyebrow';
import { avatarRenderUrl } from '@stage-labs/client/profile/avatar';
import { channelStampSeed, stampAvatarUrl } from '@stage-labs/kit/avatar';
import { usePalette } from '../../lib/theme';
import { PROFILE_AVATAR_SIZE, ProfileCover } from '../ProfileCover';
import { TitleText } from '../TitleText';
import { channelTitle } from '../conversation/convTitle';

export function ChannelProfileHeader({ imageUrl, channelId, insetTop, onView, children }: {
  imageUrl: string; channelId: string; insetTop: number; onView: () => void; children: ReactNode;
}): React.ReactElement {
  const { bg, border: rowBg } = usePalette();
  const fallbackUri = channelId ? stampAvatarUrl(channelStampSeed(channelId), PROFILE_AVATAR_SIZE) : '';
  return (
    <ProfileCover
      insetTop={insetTop}
      avatar={
        <Pressable onPress={onView} disabled={!imageUrl} hitSlop={8}>
          <Image
            src={imageUrl ? avatarRenderUrl('', imageUrl, 256) : fallbackUri}
            style={{
              width: PROFILE_AVATAR_SIZE, height: PROFILE_AVATAR_SIZE, borderRadius: Math.round(PROFILE_AVATAR_SIZE * 0.12),
              backgroundColor: rowBg, borderWidth: 3, borderColor: bg,
            }}
          />
        </Pressable>
      }
    >
      {children}
    </ProfileCover>
  );
}

export function ChannelTitle({ name, description }: { name: string | null; description: string }): React.ReactElement {
  const { link: head, text: fg } = usePalette();
  const about = description.trim();
  return (
    <>
      <Box padding={{ x: PAGE_GUTTER, top: 14, bottom: 16 }}>
        <TitleText title={channelTitle(name)} weight="semibold" size="2xl" color={head} style={{ textAlign: 'left' }}/>
      </Box>
      {about ? (
        <Box padding={{ x: PAGE_GUTTER, bottom: 16 }}>
          <Eyebrow>DESCRIPTION</Eyebrow>
          <Text size="2xs" color={fg} style={{ marginTop: 6 }}>{about}</Text>
        </Box>
      ) : null}
    </>
  );
}
