/** "Common channels" section on a peer's profile (see ProfileScreen.tsx).
 *  Lists the GROUP conversations the local user and the viewed peer are BOTH
 *  members of, each tappable → that group's conversation. Only mounted for
 *  OTHER users; resolution runs async via `useCommonChannels` so it never
 *  blocks the profile render. Renders nothing until at least one common
 *  channel resolves (or shows a small loader while still walking groups).
 *
 *  Each row reuses the shared `ChannelRow` as flat full-width rows so this
 *  section reads identically to the channels-tab list (no surrounding card,
 *  no chevron). The preview/unread/timestamp come from the SAME persisted
 *  channels cache the channels tab writes (via `useCommonChannels`), so a row
 *  here renders byte-for-byte like the homepage: last-message preview (with the
 *  "You: …" / sender-name prefix), unread badge, timestamp, draft + pin glyphs.
 *  When the cache has no entry for a group yet, it falls back to the member
 *  count subtitle. */

import { ActivityIndicator, Text } from 'react-native';
import { Box } from './layout';
import { useRouter } from 'expo-router';
import { ChannelRow } from './ChannelRow';
import { getPeerAvatarCb, getPeerName, isPeerResolved } from '../lib/peerProfiles';
import { useCommonChannels } from '../lib/useCommonChannels';
import { shortAddress } from '../lib/xmtp';
import { hasDraft } from '../lib/drafts';
import { isPinned } from '../lib/pins';
import type { ProfileColors } from './ProfileScreen.parts';

/** Same timestamp formatting as the channels tab (app/(tabs)/index.tsx fmtTs):
 *  time-of-day for today, "Mon D" otherwise; empty when there's no message. */
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

  /** Nothing to show, and finished resolving → render nothing at all. */
  if (channels.length === 0 && !loading) return null;

  return (
    <Box style={{ marginTop: 20 }}>
      <Box style={{
        flexDirection: 'row', alignItems: 'center', gap: 8,
        marginHorizontal: 20, marginBottom: 6,
      }}>
        <Text style={{ color: c.sub, fontSize: 11, fontFamily: 'Calibre-Medium' }}>
          COMMON CHANNELS
        </Text>
        {loading ? <ActivityIndicator size="small" color={c.sub} /> : null}
      </Box>

      {/* Flat full-width rows — identical to the channels tab (index.tsx
          renderRow): same preview prefix, timestamp, unread badge, pin/draft
          glyphs. The preview/unread/timestamp come from the shared channels
          cache (see useCommonChannels). When there's no cached last message we
          fall back to the member-count subtitle, exactly as before. */}
      {channels.map(ch => {
        const hasMsg = ch.lastPreview.length > 0;
        /** Mirror index.tsx renderRow: always show the sender's name prefix
         *  (self-sent included — the daemon/agent shares the inbox, so "You:"
         *  would hide a legitimate agent reply; show its profile name instead). */
        const preview = hasMsg
          ? `${ch.lastSenderAddress ? `${getPeerName(ch.lastSenderAddress) ?? shortAddress(ch.lastSenderAddress)}: ` : ''}${ch.lastPreview}`
          : null;
        /** Group avatar stamp only once the address profile is resolved (same
         *  guard the channels tab uses to avoid a flash of the wrong stamp). */
        const showAddr = !ch.avatarUri && ch.avatarAddress && isPeerResolved(ch.avatarAddress)
          ? ch.avatarAddress : null;
        return (
          <ChannelRow
            key={ch.convId}
            title={ch.title}
            avatarUri={ch.avatarUri}
            avatarAddress={showAddr}
            cacheBuster={ch.avatarAddress ? getPeerAvatarCb(ch.avatarAddress) : undefined}
            square
            lastPreview={preview}
            subtitle={`${ch.memberCount} member${ch.memberCount === 1 ? '' : 's'}`}
            timestamp={fmtTs(ch.lastTs)}
            unreadCount={ch.unreadCount}
            markedUnread={ch.markedUnread}
            pinned={isPinned(ch.convId)}
            hasDraft={hasDraft(ch.convId)}
            onPress={() => router.push({ pathname: '/xmtp/[convId]', params: { convId: ch.convId } })}
          />
        );
      })}
    </Box>
  );
}
