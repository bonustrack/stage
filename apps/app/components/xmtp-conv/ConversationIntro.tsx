/** @file The avatar + name intro header shown at the visual top of a conversation once all history is loaded, with distinct DM and group variants, rendered in ConversationFeed's inverted-list footer. */

import { Pressable } from '@metro-labs/kit/pressable';

import { Text } from '@metro-labs/kit/text';
import { Box, Row } from '../layout';
import { Avatar } from '../Avatar';
import { getPeerName } from '../../lib/peerProfiles';
import { channelStampSeed } from '@metro-labs/kit/avatar';
import { shortAddress } from '../../modules/messaging';

/** Read-only label chips for the group intro — same rounded-pill look as the ChannelRow inline chips, just left-aligned under the name. Renders nothing for an empty list. */
function IntroLabelChips({ labels, fg }: {
  labels: string[]; fg: string; rowBg: string;
}): React.ReactElement | null {
  if (labels.length === 0) return null;
  return (
    <Row margin={{ top: 8 }} align="center" gap={6} justify="start" style={{ flexWrap: 'wrap' }}>
      {labels.map(label => (
        <Box radius="full" surface="raised" padding={{ x: 8, y: 2 }}
          key={label.toLowerCase()}
          
>
          <Text size="md" color={fg}>{label}</Text>
        </Box>
      ))}
    </Row>
  );
}

/** Header that introduces a conversation's peer or group details. */
export function ConversationIntro({
  isGroup, peerAddr, groupName, groupImage, groupDescription, groupLabels,
  convId, head, sub, fg, border, rowBg, onPressPeer,
}: {
  isGroup: boolean;
  peerAddr: string | null;
  groupName: string | null;
  groupImage: string;
  groupDescription: string;
  groupLabels: string[];
  convId: string;
  head: string; sub: string; fg: string; border: string; rowBg: string;
  onPressPeer: (address: string) => void;
}): React.ReactElement | null {
  if (isGroup) {
    const name = groupName === null ? '' : (groupName || 'Untitled group');
    const desc = groupDescription.trim();
    return (
      <Box padding={{ x: 12, y: 24 }} align="start">
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
        <IntroLabelChips labels={groupLabels} fg={fg} rowBg={rowBg}/>
        {desc ? (
          <Text size="4xl" color={sub} style={{ marginTop: 10, textAlign: 'left', lineHeight: 23 }}>
            {desc}
          </Text>
        ) : null}
      </Box>
    );
  }

  if (!peerAddr) return null;
  return (
    <Pressable
      onPress={() => { onPressPeer(peerAddr); }}
      style={{ alignItems: 'flex-start', paddingVertical: 24, paddingHorizontal: 12 }}
    >
      <Avatar address={peerAddr} size="lg" style={{ backgroundColor: border }} />
      <Text weight="semibold" size="5xl" color={head} style={{ lineHeight: 30, marginTop: 12, flexShrink: 1 }}>
        {getPeerName(peerAddr) ?? shortAddress(peerAddr)}
      </Text>
      <Text size="xs" color={sub} style={{ marginTop: 2 }} numberOfLines={1}>
        {shortAddress(peerAddr)}
      </Text>
    </Pressable>
  );
}
