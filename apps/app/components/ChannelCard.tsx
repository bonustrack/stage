/** Inline channel card rendered inside a message bubble when the body contains a
 *  `metro://xmtp/<convId>` channel link. Renders the SAME presentational row the
 *  Home channel list uses (ChannelRow) wrapped in a fully-bordered card so it
 *  reads as a tappable channel preview. Metadata resolves through `useConvMeta`
 *  (DM peer / group name + image); when the user isn't a member of the target
 *  conv `useConvMeta` returns EMPTY, so we fall back to a generic label keyed on
 *  the short convId — the tap still navigates to `/xmtp/[convId]` (which attempts
 *  a sync on arrival). */

import { router } from 'expo-router';
import { ChannelRow } from './ChannelRow';
import { Box } from './layout';
import { useConvMeta } from '../lib/useConvMeta';
import { usePeerProfiles, getPeerName, getPeerAvatar, getPeerAvatarCb } from '../lib/peerProfiles';
import { usePalette } from '../lib/theme';
import { shortAddress } from '../lib/xmtp';

export function ChannelCard({ convId }: { convId: string; dark?: boolean }): React.ReactElement {
  const meta = useConvMeta(convId);
  usePeerProfiles([meta.peerAddr]);
  const { border } = usePalette();

  const isGroup = meta.isGroup;
  const peer = meta.peerAddr;
  const peerName = getPeerName(peer);
  const title = isGroup
    ? (meta.groupName || 'Channel')
    : (peerName || (peer ? shortAddress(peer) : `Channel ${convId.slice(0, 6)}…`));
  const subtitle = isGroup
    ? (meta.memberAddrs.length ? `${meta.memberAddrs.length} members` : 'Channel')
    : (peer ? 'Direct message' : 'Open channel');

  const avatarUri = isGroup ? (meta.groupImage || null) : (getPeerAvatar(peer) || null);
  const avatarAddress = isGroup ? null : peer;

  const open = (): void => {
    router.push({ pathname: '/xmtp/[convId]', params: { convId } });
  };

  return (
    <Box radius={14} style={{ borderWidth: 1, borderColor: border, overflow: 'hidden' }}>
      <ChannelRow
        title={title}
        subtitle={subtitle}
        avatarUri={avatarUri}
        avatarAddress={avatarAddress}
        cacheBuster={getPeerAvatarCb(peer)}
        square={isGroup}
        onPress={open}
        noBorder
      />
    </Box>
  );
}
