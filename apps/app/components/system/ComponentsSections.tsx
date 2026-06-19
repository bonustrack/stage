/** Direct render of the app's APP-LEVEL components (NOT the @metro-labs/kit
 *  primitives, which live on the Kit page) with representative sample data. No
 *  controls, no story indirection - each component is rendered inline with a
 *  fixed sample.
 *
 *  Mapping (no literal UserCard/ChannelCard/TokenCard exports exist):
 *   - UserCard    -> ChannelRow, DM mode (circle avatar).
 *   - ChannelCard -> ChannelRow, group mode (square avatar).
 *   - TokenCard   -> TokenRow (the wallet Tokens-tab asset row).
 *   - MessageRow  -> MessengerBubble (incoming + outgoing, with reactions).
 *   - Composer    -> MessengerComposer (default empty state, stubbed handlers). */

import { Box } from '../layout';
import { GallerySection } from './GallerySection';
import { ChannelRow } from '../ChannelRow';
import { TokenRow } from '../tabs/WalletScreen.parts';
import type { AssetRow } from '../tabs/WalletScreen.assets';
import { MessengerBubble } from '../MessengerBubble';
import { MessengerComposer } from '../MessengerComposer';
import type { HistoryEntry } from '../../lib/types';
import { usePalette } from '../../lib/theme';
import type { GalleryPalette } from './galleryPalette';

const SAMPLE_USER_ADDR = '0x42e167e6bff0a3a701d8fa14f96a0f840eb939df';
const SAMPLE_SELF_ADDR = '0x2539a8b2bb4f2f0d8f1e9b5d4c3a2b1e0f9d8c7b';
const SAMPLE_MY_URI = 'metro://xmtp/user/self-showcase';
const SAMPLE_XMTP_LINE = 'metro://xmtp/0xshowcase-components-page';

const SAMPLE_INCOMING: HistoryEntry = {
  id: 'showcase-in-1',
  ts: '2026-06-05T10:00:00.000Z',
  station: 'xmtp',
  line: SAMPLE_XMTP_LINE,
  from: `metro://xmtp/user/${SAMPLE_USER_ADDR}`,
  fromName: 'vitalik.eth',
  to: SAMPLE_MY_URI,
  text: 'gm! the new Components page is looking sharp',
};

const SAMPLE_OUTGOING: HistoryEntry = {
  id: 'showcase-out-1',
  ts: '2026-06-05T10:01:00.000Z',
  station: 'xmtp',
  line: SAMPLE_XMTP_LINE,
  from: SAMPLE_MY_URI,
  fromName: 'you',
  to: `metro://xmtp/user/${SAMPLE_USER_ADDR}`,
  text: 'thanks - flip the theme above to preview every component across modes',
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

/** Renders the gallery sections showcasing UI components. */
export function ComponentsSections({ dark, head, sub, border }: GalleryPalette): React.ReactElement {
  const { bg } = usePalette();
  const sec = { head, sub, border };
  return (
    <Box>
      <GallerySection name="UserCard" note="Person row (ChannelRow, circle avatar) - DMs & profiles" {...sec}>
        <ChannelRow title="vitalik.eth" subtitle="Direct message" avatarAddress={SAMPLE_USER_ADDR} onPress={() => {/* noop */}} noBorder />
      </GallerySection>

      <GallerySection name="ChannelCard" note="Channel row (ChannelRow, square avatar) - groups & channels" {...sec}>
        <ChannelRow
          title="Metro Dev" subtitle="12 members" avatarAddress={SAMPLE_USER_ADDR} square
          lastPreview="Less: shipping the Components page" onPress={() => {/* noop */}} noBorder
        />
      </GallerySection>

      <GallerySection name="TokenCard" note="Wallet asset row (TokenRow) - the Tokens tab" {...sec} innerPadH={14}>
        <TokenRow r={SAMPLE_TOKEN} head={head} sub={sub} border={border} bg={bg} onPress={() => {/* noop */}} />
      </GallerySection>

      <GallerySection name="MessageRow" note="Chat message row (MessengerBubble) - the conversation feed" {...sec} innerPadV={6}>
        <MessengerBubble entry={SAMPLE_INCOMING} dark={dark} unread={false} myUri={SAMPLE_MY_URI} senderEthAddress={SAMPLE_USER_ADDR} />
        <MessengerBubble
          entry={SAMPLE_OUTGOING} dark={dark} unread={false} myUri={SAMPLE_MY_URI}
          senderEthAddress={SAMPLE_SELF_ADDR} reactions={new Map([['👍', 2], ['🚀', 1]])}
        />
      </GallerySection>

      <GallerySection name="Composer" note="Message composer (MessengerComposer) - default empty state" {...sec}>
        <MessengerComposer dark={dark} xmtpLine={SAMPLE_XMTP_LINE} />
      </GallerySection>
    </Box>
  );
}
