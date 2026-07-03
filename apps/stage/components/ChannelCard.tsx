
import { router } from 'expo-router';
import { ChannelRow } from './ChannelRow';
import { DmPeerCard } from './ChannelCard.dm';
import { Box } from './layout';
import { useConvMeta } from '../modules/messaging';
import { usePeerProfiles, getPeerName, isPeerResolved } from '../lib/peerProfiles';
import { channelStampSeed } from '@stage-labs/kit/avatar';
import { usePalette, useBlockRadius } from '../lib/theme';
import { shortAddress } from '../modules/messaging';

export function ChannelCard(
  { convId, peerAddress }: { convId?: string; peerAddress?: string; dark?: boolean },
): React.ReactElement | null {
  if (peerAddress) return <DmPeerCard address={peerAddress} />;
  if (!convId) return null;
  return <ConvIdCard convId={convId} />;
}

function convTitle(meta: ReturnType<typeof useConvMeta>, convId: string): string {
  if (meta.isGroup) return meta.groupName == null || meta.groupName === '' ? 'Channel' : meta.groupName;
  const peerName = getPeerName(meta.peerAddr);
  if (peerName != null && peerName !== '') return peerName;
  return meta.peerAddr ? shortAddress(meta.peerAddr) : `Channel ${convId.slice(0, 6)}…`;
}

function convSubtitle(meta: ReturnType<typeof useConvMeta>): string {
  if (meta.isGroup) return meta.memberAddrs.length ? `${meta.memberAddrs.length} members` : 'Channel';
  return meta.peerAddr ? 'Direct message' : 'Open channel';
}

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

function ConvIdCard({ convId }: { convId: string }): React.ReactElement {
  const meta = useConvMeta(convId);
  usePeerProfiles([meta.peerAddr]);
  const { border } = usePalette();
  const blockRadius = useBlockRadius();

  const title = convTitle(meta, convId);
  const subtitle = convSubtitle(meta);
  const { avatarUri, avatarAddress } = convAvatar(meta, convId);

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
