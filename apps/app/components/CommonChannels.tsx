
import { Pressable } from '@stage-labs/kit/pressable';

import { Text } from '@stage-labs/kit/text';
import { Box, Row } from './layout';
import { Spinner } from './Spinner';
import { useRouter } from 'expo-router';
import { ChannelRow } from './ChannelRow';
import { getPeerName } from '../lib/peerProfiles';
import { useCommonChannels } from '../lib/useCommonChannels';
import { shortAddress } from '../modules/messaging';
import { hasDraft, getDraft } from '../lib/drafts';
import { isPinned } from '../lib/pins';
import type { ProfileColors } from './ProfileScreen.parts';

function fmtTs(ts: number | null): string {
  if (!ts) return '';
  const d = new Date(ts);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function CommonChannels({ peerAddress, enabled, c }: {
  peerAddress: string | null;
  enabled: boolean;
  c: ProfileColors;
}): React.ReactElement | null {
  const router = useRouter();
  const { channels, loading } = useCommonChannels(peerAddress, enabled);

  if (channels.length === 0 && !loading) return null;

  return (
    <Box margin={{ top: 20 }}>
      {}
      <Row margin={{ x: 16, bottom: 6 }} justify="start" align="center" gap={24} 
        style={{ borderBottomWidth: 1, borderBottomColor: c.border }}>
        <Pressable style={{ paddingVertical: 10, marginBottom: -1, borderBottomWidth: 2, borderBottomColor: c.link }}>
          <Text weight="semibold" size="3xl" color={c.link}>
            Channels
          </Text>
        </Pressable>
        {loading ? <Spinner size={20} color={c.text} /> : null}
      </Row>

      {}
      {channels.map(ch => {
        const hasMsg = ch.lastPreview.length> 0;
        const preview = hasMsg
          ? `${ch.lastSenderAddress ? `${getPeerName(ch.lastSenderAddress) ?? shortAddress(ch.lastSenderAddress)}: ` : ''}${ch.lastPreview}`
          : null;
        const showAddr = ch.avatarUri || !ch.avatarAddress ? null : ch.avatarAddress;
        return (
          <ChannelRow
            key={ch.convId}
            title={ch.title}
            avatarUri={ch.avatarUri}
            avatarAddress={showAddr}
            square
            lastPreview={preview}
            subtitle={`${ch.memberCount} member${ch.memberCount === 1 ? '' : 's'}`}
            timestamp={fmtTs(ch.lastTs)}
            unreadCount={ch.unreadCount}
            markedUnread={ch.markedUnread}
            pinned={isPinned(ch.convId)}
            hasDraft={hasDraft(ch.convId)}
            draftText={getDraft(ch.convId)}
            onPress={() => { router.push({ pathname: '/xmtp/[convId]', params: { convId: ch.convId } }); }}
          />
        );
      })}
    </Box>
  );
}
