/** Components page — a showcase of the app's main APP-LEVEL UI components (NOT
 *  the @metro-labs/kit primitives, which live on the Kit page). Renders the
 *  UserCard, ChannelCard and TokenCard equivalents with representative sample
 *  data, and hosts the same app-wide ThemeSwitcher as the Kit gallery so each
 *  component can be previewed across System / Light / Dark.
 *
 *  Component mapping (the app has no literal `UserCard`/`ChannelCard`/`TokenCard`
 *  exports — these are the real equivalents):
 *   - UserCard    → ChannelRow in DM mode (circle avatar) inside a bordered card,
 *                   exactly how the app presents a person (DmPeerCard style).
 *   - ChannelCard → ChannelRow in group mode (square avatar) inside a bordered
 *                   card, exactly how the app presents a channel (ConvIdCard).
 *   - TokenCard   → TokenRow (the wallet Tokens-tab asset row).
 *   - MessageRow  → MessengerBubble (the Discord-style chat message row used in
 *                   the conversation feed), shown as an incoming + an outgoing
 *                   message with sample text + reactions.
 *   - Composer    → MessengerComposer (the two-line message input/editor),
 *                   rendered in its default empty state with stubbed handlers so
 *                   it shows statically without sending or recording. */

import { Box } from '../layout';
import { Text } from '@metro-labs/kit/text';
import { Title } from '@metro-labs/kit/title';
import { ThemeSwitcher } from './ThemeSwitcher';
import { ChannelRow } from '../ChannelRow';
import { TokenRow } from '../tabs/WalletScreen.parts';
import type { AssetRow } from '../tabs/WalletScreen.assets';
import { MessengerBubble } from '../MessengerBubble';
import { MessengerComposer } from '../MessengerComposer';
import type { HistoryEntry } from '../../lib/types';
import { usePalette, useBlockRadius } from '../../lib/theme';

/** Representative sample data — static, no network. Addresses are real-looking
 *  so the stamp.fyi identicon resolves a distinct avatar per card. */
const SAMPLE_USER_ADDR = '0x42e167e6bff0a3a701d8fa14f96a0f840eb939df';
const SAMPLE_SELF_ADDR = '0x2539a8b2bb4f2f0d8f1e9b5d4c3a2b1e0f9d8c7b';

/** Self URI for the showcase — marks SAMPLE_OUTGOING as "the local user's own"
 *  message (the Discord-style row doesn't restyle own messages, but the prop is
 *  required by the bubble contract). */
const SAMPLE_MY_URI = `metro://xmtp/user/self-showcase`;

/** A non-real XMTP line — the composer keys its (async-storage) draft by this id,
 *  so it stays isolated from any real conversation draft. */
const SAMPLE_XMTP_LINE = 'metro://xmtp/0xshowcase-components-page';

/** Two static chat messages — an incoming peer message and the local user's own
 *  reply (with a couple of reactions) so the bubble shows text + reaction pills. */
const SAMPLE_INCOMING: HistoryEntry = {
  id: 'showcase-in-1',
  ts: '2026-06-05T10:00:00.000Z',
  station: 'xmtp',
  line: SAMPLE_XMTP_LINE,
  from: `metro://xmtp/user/${SAMPLE_USER_ADDR}`,
  fromName: 'vitalik.eth',
  to: SAMPLE_MY_URI,
  text: 'gm! the new Components page is looking sharp 👀',
};

const SAMPLE_OUTGOING: HistoryEntry = {
  id: 'showcase-out-1',
  ts: '2026-06-05T10:01:00.000Z',
  station: 'xmtp',
  line: SAMPLE_XMTP_LINE,
  from: SAMPLE_MY_URI,
  fromName: 'you',
  to: `metro://xmtp/user/${SAMPLE_USER_ADDR}`,
  text: 'thanks — flip the theme above to preview every component across modes ✨',
};

const SAMPLE_TOKEN: AssetRow = {
  symbol: 'ETH',
  name: 'Ethereum',
  chainId: 1,
  balance: '1.245',
  priceUsd: 3120.42,
  change24h: 2.41,
  logoUrl: 'https://cdn.stamp.fyi/avatar/eth:0x0000000000000000000000000000000000000000?s=64',
};

/** Section wrapper — a labelled block (name + one-line description of which app
 *  component it maps to) holding a single live example. Mirrors the Kit page's
 *  preview-above-controls rhythm, sans the controls (these are real components
 *  with fixed sample data, not configurable primitives). */
function Section({ name, maps, head, sub, children }: {
  name: string; maps: string; head: string; sub: string; children: React.ReactNode;
}): React.ReactElement {
  return (
    <Box style={{ paddingHorizontal: 16, paddingTop: 22 }}>
      <Text style={{ color: head, fontSize: 18, fontFamily: 'Calibre-Semibold' }}>{name}</Text>
      <Text style={{ color: sub, fontSize: 13, marginTop: 1, marginBottom: 12, fontFamily: 'Calibre-Medium' }}>
        {maps}
      </Text>
      {children}
    </Box>
  );
}

export function ComponentsGallery({ dark, head, sub, border, rowBg }: {
  dark: boolean; head: string; sub: string; border: string; rowBg: string;
}): React.ReactElement {
  const { bg } = usePalette();
  const blockRadius = useBlockRadius();

  return (
    <Box style={{ paddingBottom: 8 }}>
      <ThemeSwitcher dark={dark} head={head} sub={sub} border={border} rowBg={rowBg} />

      <Box style={{ paddingHorizontal: 16, paddingTop: 18 }}>
        <Title dark={dark} level={3} color={head}>Components</Title>
        <Text style={{ color: sub, fontSize: 13, marginTop: 4, fontFamily: 'Calibre-Medium' }}>
          App-level UI components with sample data. Flip the theme above to preview them.
        </Text>
      </Box>

      <Section
        name="UserCard"
        maps="Person row (ChannelRow, circle avatar) — used for DMs & profiles"
        head={head} sub={sub}
      >
        <Box radius={blockRadius} style={{ borderWidth: 1, borderColor: border, overflow: 'hidden' }}>
          <ChannelRow
            title="vitalik.eth"
            subtitle="Direct message"
            avatarAddress={SAMPLE_USER_ADDR}
            onPress={() => {}}
            noBorder
          />
        </Box>
      </Section>

      <Section
        name="ChannelCard"
        maps="Channel row (ChannelRow, square avatar) — used for groups & channel links"
        head={head} sub={sub}
      >
        <Box radius={blockRadius} style={{ borderWidth: 1, borderColor: border, overflow: 'hidden' }}>
          <ChannelRow
            title="Metro Dev"
            subtitle="12 members"
            avatarAddress={SAMPLE_USER_ADDR}
            square
            lastPreview="Less: shipping the Components page 🚀"
            onPress={() => {}}
            noBorder
          />
        </Box>
      </Section>

      <Section
        name="TokenCard"
        maps="Wallet asset row (TokenRow) — used in the Tokens tab"
        head={head} sub={sub}
      >
        <Box radius={blockRadius} style={{ borderWidth: 1, borderColor: border, overflow: 'hidden' }}>
          <Box style={{ paddingHorizontal: 14 }}>
            <TokenRow r={SAMPLE_TOKEN} head={head} sub={sub} border={border} bg={bg} onPress={() => {}} />
          </Box>
        </Box>
      </Section>

      <Section
        name="MessageRow"
        maps="Chat message row (MessengerBubble) — used in the conversation feed"
        head={head} sub={sub}
      >
        <Box radius={blockRadius} style={{ borderWidth: 1, borderColor: border, overflow: 'hidden', paddingVertical: 6 }}>
          <MessengerBubble
            entry={SAMPLE_INCOMING}
            dark={dark}
            unread={false}
            myUri={SAMPLE_MY_URI}
            senderEthAddress={SAMPLE_USER_ADDR}
          />
          <MessengerBubble
            entry={SAMPLE_OUTGOING}
            dark={dark}
            unread={false}
            myUri={SAMPLE_MY_URI}
            senderEthAddress={SAMPLE_SELF_ADDR}
            reactions={new Map([['👍', 2], ['🚀', 1]])}
          />
        </Box>
      </Section>

      <Section
        name="Composer"
        maps="Message composer (MessengerComposer) — default empty state"
        head={head} sub={sub}
      >
        <Box radius={blockRadius} style={{ borderWidth: 1, borderColor: border, overflow: 'hidden' }}>
          <MessengerComposer dark={dark} xmtpLine={SAMPLE_XMTP_LINE} />
        </Box>
      </Section>
    </Box>
  );
}
