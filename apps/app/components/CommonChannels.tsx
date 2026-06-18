/** "Channels" section on a peer's profile (see ProfileScreen.tsx).
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

import { Pressable } from '@metro-labs/kit/pressable';

import { Text } from '@metro-labs/kit/text';
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

/** Renders the profile section listing groups the local user and the viewed peer both belong to. */
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
    <Box margin={{ top: 20 }}>
      {/* Underline-tab header — mirrors the Wallet page's WalletTabs visual
          treatment (active bottom-border, 18px Calibre-Semibold, head colour),
          rendered as a single tab. */}
      <Row margin={{ x: 16, bottom: 6 }} justify="start" align="center" gap={24} 
        style={{ borderBottomWidth: 1, borderBottomColor: c.border }}>
        <Pressable style={{ paddingVertical: 10, marginBottom: -1, borderBottomWidth: 2, borderBottomColor: c.link }}>
          <Text weight="semibold" size="3xl" color={c.link}>
            Channels
          </Text>
        </Pressable>
        {loading ? <Spinner size={20} color={c.text} /> : null}
      </Row>

      {/* Flat full-width rows — identical to the channels tab (index.tsx
          renderRow): same preview prefix, timestamp, unread badge, pin/draft
          glyphs. The preview/unread/timestamp come from the shared channels
          cache (see useCommonChannels). When there's no cached last message we
          fall back to the member-count subtitle, exactly as before. */}
      {channels.map(ch => {
        const hasMsg = ch.lastPreview.length> 0;
        /** Mirror index.tsx renderRow: always show the sender's name prefix
         *  (self-sent included — the daemon/agent shares the inbox, so "You:"
         *  would hide a legitimate agent reply; show its profile name instead). */
        const preview = hasMsg
          ? `${ch.lastSenderAddress ? `${getPeerName(ch.lastSenderAddress) ?? shortAddress(ch.lastSenderAddress)}: ` : ''}${ch.lastPreview}`
          : null;
        /** Mirror HomeScreen.helpers showAddr: an uploaded group image takes
         *  precedence (avatarUri). Otherwise these are all GROUPS, so the
         *  channel's own stamp seed (avatarAddress) renders immediately — no
         *  peer-resolution gate (the seed isn't a member address). */
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
            onPress={() => router.push({ pathname: '/xmtp/[convId]', params: { convId: ch.convId } })}
          />
        );
      })}
    </Box>
  );
}
