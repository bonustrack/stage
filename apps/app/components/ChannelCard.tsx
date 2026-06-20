/** @file Inline message-bubble card rendering a `metro://xmtp/<convId>` link as a bordered, tappable ChannelRow preview (DM/group metadata via useConvMeta, generic label when not a member). */

import { router } from 'expo-router';
import { ChannelRow } from './ChannelRow';
import { DmPeerCard } from './ChannelCard.dm';
import { Box } from './layout';
import { useConvMeta } from '../modules/messaging';
import { usePeerProfiles, getPeerName, isPeerResolved } from '../lib/peerProfiles';
import { channelStampSeed } from '@stage-labs/kit/avatar';
import { usePalette, useBlockRadius } from '../lib/theme';
import { shortAddress } from '../modules/messaging';

/** With `peerAddress` set it's a DM-by-address share rendering the peer card; otherwise a conv-id link (group or DM-by-id) resolved through `useConvMeta`. */
export function ChannelCard(
  { convId, peerAddress }: { convId?: string; peerAddress?: string; dark?: boolean },
): React.ReactElement | null {
  if (peerAddress) return <DmPeerCard address={peerAddress} />;
  if (!convId) return null;
  return <ConvIdCard convId={convId} />;
}

/** Resolve the title text for a conv-id channel card (group name or peer name/address). */
function convTitle(meta: ReturnType<typeof useConvMeta>, convId: string): string {
  if (meta.isGroup) return meta.groupName == null || meta.groupName === '' ? 'Channel' : meta.groupName;
  const peerName = getPeerName(meta.peerAddr);
  if (peerName != null && peerName !== '') return peerName;
  return meta.peerAddr ? shortAddress(meta.peerAddr) : `Channel ${convId.slice(0, 6)}…`;
}

/** Resolve the subtitle text for a conv-id channel card (member count or DM label). */
function convSubtitle(meta: ReturnType<typeof useConvMeta>): string {
  if (meta.isGroup) return meta.memberAddrs.length ? `${meta.memberAddrs.length} members` : 'Channel';
  return meta.peerAddr ? 'Direct message' : 'Open channel';
}

/** Resolve {avatarUri, avatarAddress} for a conv-id channel card, mirroring HomeScreen. */
function convAvatar(
  meta: ReturnType<typeof useConvMeta>, convId: string,
): { avatarUri: string | null; avatarAddress: string | null } {
  const isGroup = meta.isGroup;
  const avatarUri = isGroup ? (meta.groupImage?.trim() || null) : null;
  const avatarSeed = isGroup ? (avatarUri ? null : channelStampSeed(convId)) : meta.peerAddr;
  let avatarAddress: string | null = null;
  if (!avatarUri && avatarSeed && (isGroup || isPeerResolved(avatarSeed))) avatarAddress = avatarSeed;
  return { avatarUri, avatarAddress };
}

/** The Conv Id Card component. */
function ConvIdCard({ convId }: { convId: string }): React.ReactElement {
  const meta = useConvMeta(convId);
  usePeerProfiles([meta.peerAddr]);
  const { border } = usePalette();
  const blockRadius = useBlockRadius();

  const title = convTitle(meta, convId);
  const subtitle = convSubtitle(meta);
  const { avatarUri, avatarAddress } = convAvatar(meta, convId);

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
        square={meta.isGroup}
        onPress={open}
        noBorder
      />
    </Box>
  );
}
