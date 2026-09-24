
import { Pressable } from '@stage-labs/kit/react-native/pressable';

import { Text } from '@stage-labs/kit/react-native/text';
import { Box, Row, PAGE_GUTTER } from '../layout';
import { Avatar } from '../Avatar';
import { convTitle } from './convTitle';
import { channelStampSeed } from '@stage-labs/kit/avatar';
import { shortAddress } from '../../modules/messaging';
import { useRouter } from 'expo-router';
import { usePalette } from '../../lib/theme';
import { profileLinkOf } from '../../lib/links';
import type { useConversationState } from './useConversationState';

function IntroLabelChips({ labels, fg }: {
  labels: string[]; fg: string;
}): React.ReactElement | null {
  if (labels.length === 0) return null;
  return (
    <Row margin={{ top: 8 }} align="center" gap={6} justify="start" style={{ flexWrap: 'wrap' }}>
      {labels.map(label => (
        <Box radius="full" surface="raised" padding={{ x: 8, y: 2 }} key={label.toLowerCase()}>
          <Text size="md" color={fg}>{label}</Text>
        </Box>
      ))}
    </Row>
  );
}

export function ConversationIntro({ c, convId }: {
  c: ReturnType<typeof useConversationState>; convId: string;
}): React.ReactElement | null {
  const { isGroup, peerAddr, groupName, groupImage, groupDescription, groupLabels } = c;
  const { text: fg, link: head, border } = usePalette();
  const router = useRouter();
  if (isGroup) {
    const name = convTitle({ isGroup, groupName, peerAddr });
    const desc = groupDescription.trim();
    return (
      <Box padding={{ x: PAGE_GUTTER, y: 24 }} align="start">
        <Avatar
          imageUri={groupImage || undefined}
          address={!groupImage && convId ? channelStampSeed(convId) : null}
          size="lg"
          square
          style={{ backgroundColor: border }}
/>
        <Text weight="semibold" size="5xl" color={head} style={{ lineHeight: 30, marginTop: 12, textAlign: 'left', flexShrink: 1 }}>
          {name}
        </Text>
        <IntroLabelChips labels={groupLabels} fg={fg}/>
        {desc ? (
          <Text size="4xl" role="secondary" style={{ marginTop: 10, textAlign: 'left', lineHeight: 23 }}>
            {desc}
          </Text>
        ) : null}
      </Box>
    );
  }

  if (!peerAddr) return null;
  return (
    <Pressable
      onPress={() => { router.push(profileLinkOf(peerAddr)); }}
      style={{ alignItems: 'flex-start', paddingVertical: 24, paddingHorizontal: PAGE_GUTTER }}
    >
      <Avatar address={peerAddr} size="lg" style={{ backgroundColor: border }} />
      <Text weight="semibold" size="5xl" color={head} style={{ lineHeight: 30, marginTop: 12, flexShrink: 1 }}>
        {convTitle({ isGroup, groupName, peerAddr })}
      </Text>
      <Text size="xs" role="secondary" style={{ marginTop: 2 }} numberOfLines={1}>
        {shortAddress(peerAddr)}
      </Text>
    </Pressable>
  );
}
