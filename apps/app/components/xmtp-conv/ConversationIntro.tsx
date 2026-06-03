/** Empty-state intro header shown at the visual TOP of a conversation, once all
 *  history is loaded — the avatar + name block above the first message.
 *
 *  Rendered inside ConversationFeed's ListFooterComponent (inverted list, so the
 *  footer is the top). Two variants:
 *    - DM   → round peer avatar + display name + short address + Snapshot bio.
 *    - Group → SQUARED avatar + group name + label chips + group description.
 *
 *  Presentation only; all data is resolved by the caller (useConversationState /
 *  useConvMeta / peerProfiles) and passed in. Kept in its own file so
 *  ConversationFeed stays under the 200-line cap. */

import { Pressable } from 'react-native';
import { Text } from '@metro-labs/kit/text';
import { Box, Row } from '../layout';
import { Avatar } from '../Avatar';
import { getPeerName, getPeerAvatar, getPeerAbout } from '../../lib/peerProfiles';
import { channelStampSeed } from '@metro-labs/kit/avatar';
import { shortAddress } from '../../lib/xmtp';

/** Read-only label chips for the group intro — same rounded-pill look as the
 *  ChannelRow inline chips, just left-aligned under the name. Renders nothing for
 *  an empty list. */
function IntroLabelChips({ labels, fg, rowBg }: {
  labels: string[]; fg: string; rowBg: string;
}): React.ReactElement | null {
  if (labels.length === 0) return null;
  return (
    <Row align="center" gap={6} mt={8} style={{ flexWrap: 'wrap', justifyContent: 'flex-start' }}>
      {labels.map(label => (
        <Box
          key={label.toLowerCase()}
          style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: rowBg }}
        >
          <Text style={{ color: fg, fontSize: 12, fontFamily: 'Calibre-Medium' }}>{label}</Text>
        </Box>
      ))}
    </Row>
  );
}

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
      <Box style={{ alignItems: 'flex-start', paddingVertical: 24, paddingHorizontal: 24 }}>
        <Avatar
          imageUri={groupImage || undefined}
          address={!groupImage && convId ? channelStampSeed(convId) : null}
          size="lg"
          square
          style={{ backgroundColor: border }}
        />
        <Text
          style={{ color: head, fontSize: 20, fontFamily: 'Calibre-Semibold', marginTop: 12, textAlign: 'left' }}
          numberOfLines={2}
        >
          {name}
        </Text>
        <IntroLabelChips labels={groupLabels} fg={fg} rowBg={rowBg} />
        {desc ? (
          <Text
            style={{ color: sub, fontSize: 15, fontFamily: 'Calibre-Medium', marginTop: 10, textAlign: 'left', lineHeight: 20 }}
          >
            {desc}
          </Text>
        ) : null}
      </Box>
    );
  }

  if (!peerAddr) return null;
  const about = getPeerAbout(peerAddr);
  return (
    <Pressable
      onPress={() => onPressPeer(peerAddr)}
      style={{ alignItems: 'flex-start', paddingVertical: 24, paddingHorizontal: 24 }}
    >
      <Avatar address={peerAddr} imageUri={getPeerAvatar(peerAddr)} size="lg" style={{ backgroundColor: border }} />
      <Text style={{ color: head, fontSize: 20, fontFamily: 'Calibre-Semibold', marginTop: 12 }} numberOfLines={1}>
        {getPeerName(peerAddr) ?? shortAddress(peerAddr)}
      </Text>
      <Text style={{ color: sub, fontSize: 13, fontFamily: 'Calibre-Medium', marginTop: 2 }} numberOfLines={1}>
        {shortAddress(peerAddr)}
      </Text>
      {about ? (
        <Text
          style={{ color: sub, fontSize: 15, fontFamily: 'Calibre-Medium', marginTop: 10, textAlign: 'left', lineHeight: 20 }}
        >
          {about}
        </Text>
      ) : null}
    </Pressable>
  );
}
