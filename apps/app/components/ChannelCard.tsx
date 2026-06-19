/**
 * @file Inline message-bubble card that renders a `metro://xmtp/<convId>` channel
 *  link as a bordered, tappable ChannelRow preview (resolving DM/group metadata
 *  via useConvMeta, falling back to a generic label when not a member).
 */

import { router } from 'expo-router';
import { ChannelRow } from './ChannelRow';
import { DmPeerCard } from './ChannelCard.dm';
import { Box } from './layout';
import { useConvMeta } from '../modules/messaging';
import { usePeerProfiles, getPeerName, isPeerResolved } from '../lib/peerProfiles';
import { channelStampSeed } from '@metro-labs/kit/avatar';
import { usePalette, useBlockRadius } from '../lib/theme';
import { shortAddress } from '../modules/messaging';

/**
 * When `peerAddress` is set the link is a DM-by-address share
 *  (`metro://xmtp/user/<addr>`): render the peer card + open-on-tap path that
 *  resolves each side's own local DM. Otherwise it's a conv-id link (group or
 *  DM-by-id) resolved through `useConvMeta`.
 */
export function ChannelCard(
  { convId, peerAddress }: { convId?: string; peerAddress?: string; dark?: boolean },
): React.ReactElement | null {
  if (peerAddress) return <DmPeerCard address={peerAddress} />;
  if (!convId) return null;
  return <ConvIdCard convId={convId} />;
}

/** The Conv Id Card component. */
function ConvIdCard({ convId }: { convId: string }): React.ReactElement {
  const meta = useConvMeta(convId);
  usePeerProfiles([meta.peerAddr]);
  const { border } = usePalette();
  const blockRadius = useBlockRadius();

  const isGroup = meta.isGroup;
  const peer = meta.peerAddr;
  const peerName = getPeerName(peer);
  const title = isGroup
    ? (meta.groupName == null || meta.groupName === '' ? 'Channel' : meta.groupName)
    : (peerName == null || peerName === '' ? (peer ? shortAddress(peer) : `Channel ${convId.slice(0, 6)}…`) : peerName);
  const subtitle = isGroup
    ? (meta.memberAddrs.length ? `${meta.memberAddrs.length} members` : 'Channel')
    : (peer ? 'Direct message' : 'Open channel');

  /**
   * Mirror HomeScreen.helpers avatar resolution exactly so the card matches the
   *  Home channel list:
   *   - DM: peer's stamp (real eth address) + peer profile image if present.
   *   - Group WITH uploaded image: that image via avatarUri (address ignored).
   *   - Group WITHOUT image: a deterministic stamp seeded by the channel id.
   */
  const avatarUri = isGroup ? (meta.groupImage?.trim() || null) : null;
  const avatarSeed = isGroup
    ? (avatarUri ? null : channelStampSeed(convId))
    : peer;
  /** Render-gate (mirrors HomeScreen.parts): groups render their seed directly; DMs hold off until the peer profile resolves so we don't flash a cache-buster-less stamp before the real URL lands. */
  const avatarAddress = avatarUri || !avatarSeed
    ? null
    : isGroup || isPeerResolved(avatarSeed)
      ? avatarSeed
      : null;

  /** Open helper. */
  const open = (): void => {
    router.push({ pathname: '/xmtp/[convId]', params: { convId } });
  };

  return (
    <Box radius={blockRadius} style={{ borderWidth: 1, borderColor: border, overflow: 'hidden' }}>
      <ChannelRow
        title={title}
        subtitle={subtitle}
        avatarUri={avatarUri}
        avatarAddress={avatarAddress}
        square={isGroup}
        onPress={open}
        noBorder
      />
    </Box>
  );
}
