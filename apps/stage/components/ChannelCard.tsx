
import { router } from 'expo-router';
import { ChannelRow } from './ChannelRow';
import { Box } from './layout';
import { useConvMeta } from '../modules/messaging';
import { usePeerProfiles, getPeerName, isPeerResolved } from '../lib/peerProfiles';
import { channelStampSeed } from '@stage-labs/kit/avatar';
import { usePalette } from '../lib/theme';
import { shortAddress } from '../modules/messaging';
import { BLOCK_RADIUS_DEFAULT } from '@stage-labs/kit/tokens';
import { bubbleLinkProps } from './bubble/linkProps';
import { openInBubbleLink } from '../lib/safeOpenLink';
import { channelTitle, type ConvTitle } from './conversation/convTitle';

export function ChannelCard(
  { convId, peerAddress, url }: { convId?: string; peerAddress?: string; url?: string },
): React.ReactElement | null {
  if (peerAddress) return <DmPeerCard address={peerAddress} url={url} />;
  if (!convId) return null;
  return <ConvIdCard convId={convId} url={url} />;
}

function CardFrame({ children }: { children: React.ReactNode }): React.ReactElement {
  const { border } = usePalette();
  return (
    <Box radius={BLOCK_RADIUS_DEFAULT} style={{ borderWidth: 1, borderColor: border, overflow: 'hidden' }}>
      {children}
    </Box>
  );
}

function cardTitle(meta: ReturnType<typeof useConvMeta>, convId: string): ConvTitle {
  if (meta.isGroup) return channelTitle(meta.groupName, 'Channel');
  const peerName = getPeerName(meta.peerAddr);
  if (peerName != null && peerName !== '') return { text: peerName, placeholder: false };
  if (meta.peerAddr) return { text: shortAddress(meta.peerAddr), placeholder: false };
  return { text: `Channel ${convId.slice(0, 6)}…`, placeholder: true };
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

function ConvIdCard({ convId, url }: { convId: string; url?: string }): React.ReactElement {
  const meta = useConvMeta(convId);
  usePeerProfiles([meta.peerAddr]);

  const title = cardTitle(meta, convId);
  const subtitle = convSubtitle(meta);
  const { avatarUri, avatarAddress } = convAvatar(meta, convId);

  const open = (): void => {
    router.push({ pathname: '/channel/[convId]', params: { convId } });
  };

  return (
    <CardFrame>
      <ChannelRow
        title={title.text}
        placeholderTitle={title.placeholder}
        subtitle={subtitle}
        avatarUri={avatarUri}
        avatarAddress={avatarAddress}
        square={meta.isGroup}
        onPress={open}
        linkProps={url ? bubbleLinkProps(url, openInBubbleLink) : undefined}
      />
    </CardFrame>
  );
}

function DmPeerCard({ address, url }: { address: string; url?: string }): React.ReactElement {
  usePeerProfiles([address]);

  const peerName = getPeerName(address);
  const title = peerName == null || peerName === '' ? shortAddress(address) : peerName;
  const avatarAddress = !isPeerResolved(address) ? null : address;

  const open = (): void => {
    router.push({ pathname: '/[convId]', params: { convId: address } });
  };

  return (
    <CardFrame>
      <ChannelRow
        title={title}
        subtitle="Direct message"
        avatarAddress={avatarAddress}
        onPress={open}
        linkProps={url ? bubbleLinkProps(url, openInBubbleLink) : undefined}
      />
    </CardFrame>
  );
}
