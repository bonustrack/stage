import { Badge } from '@stage-labs/kit/react-native/badge';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Text } from '@stage-labs/kit/react-native/text';
import { ConvAvatar } from '../ConvAvatar';
import { convTitle } from '../../lib/convIdentity';
import { TitleText } from '../TitleText';
import { shortAddress } from '@stage-labs/client/identity/format';
import { useRouter } from 'expo-router';
import { usePalette } from '../../lib/theme';
import { profileLinkOf } from '../../lib/links';
import type { ConvSummary } from './useConversationState';
import { Column, Row, PAGE_GUTTER } from '../layout';

const UNTITLED_CHANNEL = 'Untitled channel';

function IntroLabelChips({ labels, fg, bg }: { labels: string[]; fg: string; bg: string }): React.ReactElement | null {
  if (labels.length === 0) return null;
  return (
    <Row margin={{ top: 8 }} align="center" gap={6} justify="start" style={{ flexWrap: 'wrap' }}>
      {labels.map((label) => (
        <Badge key={label.toLowerCase()} label={label} textSize="xs" fontWeight="normal" color={fg} background={bg} />
      ))}
    </Row>
  );
}

export function ConversationIntro({ conv, convId }: { conv: ConvSummary; convId: string }): React.ReactElement | null {
  const { isGroup, peerAddr, groupName, groupImage, groupDescription, groupLabels } = conv;
  const { text: fg, link: head, border, inputBg } = usePalette();
  const router = useRouter();
  if (isGroup) {
    const desc = groupDescription.trim();
    return (
      <Column padding={{ x: PAGE_GUTTER, y: 24 }} align="start">
        <ConvAvatar peerAddr={null} groupImage={groupImage} channelId={convId} isGroup border={border} size="lg" />
        <TitleText
          title={convTitle({ isGroup, groupName, peerAddr }, UNTITLED_CHANNEL)}
          fontWeight="medium"
          size="2xl"
          color={head}
          style={{ lineHeight: 30, marginTop: 12, textAlign: 'left', flexShrink: 1 }}
        />
        <IntroLabelChips labels={groupLabels} fg={fg} bg={inputBg} />
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
      onPress={() => {
        router.push(profileLinkOf(peerAddr));
      }}
      style={{ alignItems: 'flex-start', paddingVertical: 24, paddingHorizontal: PAGE_GUTTER }}
    >
      <ConvAvatar peerAddr={peerAddr} groupImage="" channelId={convId} isGroup={false} border={border} size="lg" />
      <TitleText
        title={convTitle({ isGroup, groupName, peerAddr }, UNTITLED_CHANNEL)}
        fontWeight="semibold"
        size="2xl"
        color={head}
        style={{ lineHeight: 30, marginTop: 12, flexShrink: 1 }}
      />
      <Text size="3xs" color="secondary" style={{ marginTop: 2 }} numberOfLines={1}>
        {shortAddress(peerAddr)}
      </Text>
    </Pressable>
  );
}
