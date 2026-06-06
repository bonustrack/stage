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
 *   - TokenCard   → TokenRow (the wallet Tokens-tab asset row). */

import { Box } from '../layout';
import { Text } from '@metro-labs/kit/text';
import { Title } from '@metro-labs/kit/title';
import { ThemeSwitcher } from './ThemeSwitcher';
import { ChannelRow } from '../ChannelRow';
import { TokenRow } from '../tabs/WalletScreen.parts';
import type { AssetRow } from '../tabs/WalletScreen.assets';
import { usePalette, useBlockRadius } from '../../lib/theme';

/** Representative sample data — static, no network. Addresses are real-looking
 *  so the stamp.fyi identicon resolves a distinct avatar per card. */
const SAMPLE_USER_ADDR = '0x42e167e6bff0a3a701d8fa14f96a0f840eb939df';

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
    </Box>
  );
}
