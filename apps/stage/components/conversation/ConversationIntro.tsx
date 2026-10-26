import { Badge } from '@stage-labs/kit/react-native/badge';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Text } from '@stage-labs/kit/react-native/text';
import { Avatar } from '../Avatar';
import { convTitle } from './convTitle';
import { TitleText } from '../TitleText';
import { channelStampSeed } from '@stage-labs/kit/avatar';
import { shortAddress } from '@stage-labs/client/identity/format';
import { useRouter } from 'expo-router';
import { usePalette } from '../../lib/theme';
import { profileLinkOf } from '../../lib/links';
import type { useConversationState } from './useConversationState';
import { Column, Row, PAGE_GUTTER } from '../layout';

function IntroLabelChips({ labels, fg, bg }: {
  labels: string[]; fg: string; bg: string;
}): React.ReactElement | null {
  if (labels.length === 0) return null;
  return (
    <Row margin={{ top: 8 }} align="center" gap={6} justify="start" style={{ flexWrap: 'wrap' }}>
      {labels.map(label => (
        <Badge key={label.toLowerCase()} label={label} textSize="xs" fontWeight="normal" color={fg} background={bg}/>
      ))}
    </Row>
  );
}

export function ConversationIntro({ c, convId }: {
  c: ReturnType<typeof useConversationState>; convId: string;
}): React.ReactElement | null {
  const { isGroup, peerAddr, groupName, groupImage, groupDescription, groupLabels } = c;
  const { text: fg, link: head, border, inputBg } = usePalette();
  const router = useRouter();
  if (isGroup) {
    const desc = groupDescription.trim();
    return (
      <Column padding={{ x: PAGE_GUTTER, y: 24 }} align="start">
        <Avatar
          imageUri={groupImage || undefined}
          address={!groupImage && convId ? channelStampSeed(convId) : null}
          size="lg"
          square
          style={{ backgroundColor: border }}
/>
        <TitleText
          title={convTitle({ isGroup, groupName, peerAddr })} fontWeight="medium" size="2xl" color={head}
          style={{ lineHeight: 30, marginTop: 12, textAlign: 'left', flexShrink: 1 }}
        />
        <IntroLabelChips labels={groupLabels} fg={fg} bg={inputBg}/>
        {desc ? (
          <Text size="xl" color="secondary" style={{ marginTop: 10, textAlign: 'left', lineHeight: 23 }}>
            {desc}
          </Text>
        ) : null}
      </Column>
    );
  }

  if (!peerAddr) return null;
  return (
    <Pressable
      onPress={() => { router.push(profileLinkOf(peerAddr)); }}
      style={{ alignItems: 'flex-start', paddingVertical: 24, paddingHorizontal: PAGE_GUTTER }}
    >
      <Avatar address={peerAddr} size="lg" style={{ backgroundColor: border }} />
      <TitleText
        title={convTitle({ isGroup, groupName, peerAddr })} fontWeight="semibold" size="2xl" color={head}
        style={{ lineHeight: 30, marginTop: 12, flexShrink: 1 }}
      />
      <Text size="3xs" color="secondary" style={{ marginTop: 2 }} numberOfLines={1}>
        {shortAddress(peerAddr)}
      </Text>
    </Pressable>
  );
}
