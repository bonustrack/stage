import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Image } from '@stage-labs/kit/react-native/image';
import { Text } from '@stage-labs/kit/react-native/text';
import { Box, PAGE_GUTTER } from '../layout';
import { avatarRenderUrl } from '@stage-labs/client/profile/avatar';
import { channelStampSeed, stampAvatarUrl } from '@stage-labs/kit/avatar';
import { usePalette } from '../../lib/theme';

export function GroupProfileHeader({ imageUrl, channelId, insetTop, onView }: {
  imageUrl: string; channelId: string; insetTop: number; onView: () => void;
}): React.ReactElement {
  const { bg, border: rowBg } = usePalette();
  const fallbackUri = channelId ? stampAvatarUrl(channelStampSeed(channelId), 88) : '';
  return (
    <>
      <Box height={140 + insetTop} surface="raised"/>
      <Box surface="surface" padding={{ x: PAGE_GUTTER }} margin={{ top: -18 }} align="start" style={{ borderTopLeftRadius: 18, borderTopRightRadius: 18, overflow: 'visible' }}>
        <Pressable onPress={onView} disabled={!imageUrl} hitSlop={8} style={{ marginTop: -44, zIndex: 1 }}>
          <Image
            src={imageUrl ? avatarRenderUrl('', imageUrl, 256) : fallbackUri}
            style={{
              width: 88, height: 88, borderRadius: Math.round(88 * 0.12),
              backgroundColor: rowBg, borderWidth: 3, borderColor: bg,
            }}
/>
        </Pressable>
      </Box>
    </>
  );
}

export function GroupTitle({ name, description }: { name: string | null; description: string }): React.ReactElement {
  const { link: head, text: fg } = usePalette();
  return (
    <>
      <Box padding={{ x: PAGE_GUTTER, top: 12, bottom: 16 }}>
        <Text weight="semibold" size="5xl" color={head} style={{ textAlign: 'left' }}>
          {name?.trim() ? name : 'Untitled group'}
        </Text>
      </Box>
      {description.trim() ? (
        <Box padding={{ x: PAGE_GUTTER, bottom: 16 }}>
          <Text size="xs" role="secondary">DESCRIPTION</Text>
          <Text size="md" color={fg} style={{ marginTop: 6 }}>{description.trim()}</Text>
        </Box>
      ) : null}
    </>
  );
}
