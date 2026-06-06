/** Components page — a showcase of the app's main APP-LEVEL UI components (NOT
 *  the @metro-labs/kit primitives, which live on the Kit page). Hosts the app-wide
 *  ThemeSwitcher (preview across System/Light/Dark) and a page-local Row/Card
 *  display toggle, then renders each component with representative sample data.
 *
 *  Component mapping (no literal UserCard/ChannelCard/TokenCard exports exist):
 *   - UserCard    → ChannelRow, DM mode (circle avatar) — a person/DM.
 *   - ChannelCard → ChannelRow, group mode (square avatar) — a channel/group.
 *   - TokenCard   → TokenRow (the wallet Tokens-tab asset row).
 *   - MessageRow  → MessengerBubble (incoming + outgoing, with reactions).
 *   - Composer    → MessengerComposer (default empty state, stubbed handlers).
 *
 *  Row/Card toggle (default Card): "Card" wraps each example in a fully-bordered
 *  rounded card; "Row" uses a single bottom divider (the flat list-row look). */

import { useState } from 'react';
import { Box, Row } from '../layout';
import { Text } from '@metro-labs/kit/text';
import { Title } from '@metro-labs/kit/title';
import { Icon } from '@metro-labs/kit/icon';
import { Button } from '@metro-labs/kit/button';
import { ThemeSwitcher } from './ThemeSwitcher';
import { ChannelRow } from '../ChannelRow';
import { TokenRow } from '../tabs/WalletScreen.parts';
import type { AssetRow } from '../tabs/WalletScreen.assets';
import { MessengerBubble } from '../MessengerBubble';
import { MessengerComposer } from '../MessengerComposer';
import type { HistoryEntry } from '../../lib/types';
import { usePalette, useBlockRadius } from '../../lib/theme';

/** Representative sample data — static, no network. Real-looking addresses so the
 *  stamp.fyi identicon resolves a distinct avatar per card. SAMPLE_MY_URI marks
 *  the outgoing message as the local user's; SAMPLE_XMTP_LINE keys the composer's
 *  draft to an isolated, non-real line. */
const SAMPLE_USER_ADDR = '0x42e167e6bff0a3a701d8fa14f96a0f840eb939df';
const SAMPLE_SELF_ADDR = '0x2539a8b2bb4f2f0d8f1e9b5d4c3a2b1e0f9d8c7b';
const SAMPLE_MY_URI = `metro://xmtp/user/self-showcase`;
const SAMPLE_XMTP_LINE = 'metro://xmtp/0xshowcase-components-page';

/** Static incoming peer message + local reply (with reactions) for the bubble. */
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

/** How each section wraps its example. */
type WrapMode = 'card' | 'row';

const WRAP_OPTIONS: { value: WrapMode; label: string; icon: 'viewGrid' | 'viewList' }[] = [
  { value: 'card', label: 'Card', icon: 'viewGrid' },
  { value: 'row', label: 'Row', icon: 'viewList' },
];

/** Row/Card toggle — mirrors the ThemeSwitcher's segmented pill, but page-local
 *  (only changes the showcase frame, not any app-wide preference). */
function DisplaySwitcher({ dark, head, mode, onChange }: {
  dark: boolean; head: string; mode: WrapMode; onChange: (m: WrapMode) => void;
}): React.ReactElement {
  return (
    <Box style={{ paddingHorizontal: 16, paddingTop: 18 }}>
      <Title dark={dark} level={3} color={head}>Display</Title>
      <Row gap={8} mt={10}>
        {WRAP_OPTIONS.map((opt) => {
          const active = mode === opt.value;
          const fg = active ? (dark ? '#000000' : '#ffffff') : head;
          return (
            <Button
              key={opt.value} dark={dark} style={{ flex: 1 }} label={opt.label}
              variant={active ? 'primary' : 'secondary'}
              onPress={() => onChange(opt.value)}
              icon={<Icon name={opt.icon} size={20} color={fg} />}
            />
          );
        })}
      </Row>
    </Box>
  );
}

/** Section wrapper — a labelled block (name + one-line mapping) holding one live
 *  example. `mode` picks the frame: "card" = fully-bordered rounded card; "row" =
 *  bottom divider only. `innerPadH`/`innerPadV` preserve an example's own padding
 *  across either frame. */
function Section({ name, maps, head, sub, border, mode, innerPadH, innerPadV, children }: {
  name: string; maps: string; head: string; sub: string; border: string;
  mode: WrapMode; innerPadH?: number; innerPadV?: number; children: React.ReactNode;
}): React.ReactElement {
  const blockRadius = useBlockRadius();
  const card = mode === 'card';
  const frame = card
    ? { borderWidth: 1, borderColor: border, overflow: 'hidden' as const }
    : { borderBottomWidth: 1, borderColor: border };
  return (
    <Box style={{ paddingHorizontal: 16, paddingTop: 22 }}>
      <Text style={{ color: head, fontSize: 18, fontFamily: 'Calibre-Semibold' }}>{name}</Text>
      <Text style={{ color: sub, fontSize: 13, marginTop: 1, marginBottom: 12, fontFamily: 'Calibre-Medium' }}>
        {maps}
      </Text>
      <Box
        radius={card ? blockRadius : 0}
        style={{ ...frame, paddingHorizontal: innerPadH, paddingVertical: innerPadV }}
      >
        {children}
      </Box>
    </Box>
  );
}

export function ComponentsGallery({ dark, head, sub, border, rowBg }: {
  dark: boolean; head: string; sub: string; border: string; rowBg: string;
}): React.ReactElement {
  const { bg } = usePalette();
  const [mode, setMode] = useState<WrapMode>('card');
  // Shared Section props — every section gets the same theme tokens + wrap mode.
  const sec = { head, sub, border, mode };

  return (
    <Box style={{ paddingBottom: 8 }}>
      <ThemeSwitcher dark={dark} head={head} sub={sub} border={border} rowBg={rowBg} />
      <DisplaySwitcher dark={dark} head={head} mode={mode} onChange={setMode} />

      <Box style={{ paddingHorizontal: 16, paddingTop: 18 }}>
        <Title dark={dark} level={3} color={head}>Components</Title>
        <Text style={{ color: sub, fontSize: 13, marginTop: 4, fontFamily: 'Calibre-Medium' }}>
          App-level UI components with sample data. Flip the theme above to preview them, or switch Row/Card display.
        </Text>
      </Box>

      <Section name="UserCard" maps="Person row (ChannelRow, circle avatar) — used for DMs & profiles" {...sec}>
        <ChannelRow title="vitalik.eth" subtitle="Direct message" avatarAddress={SAMPLE_USER_ADDR} onPress={() => {}} noBorder />
      </Section>

      <Section name="ChannelCard" maps="Channel row (ChannelRow, square avatar) — used for groups & channel links" {...sec}>
        <ChannelRow
          title="Metro Dev" subtitle="12 members" avatarAddress={SAMPLE_USER_ADDR} square
          lastPreview="Less: shipping the Components page 🚀" onPress={() => {}} noBorder
        />
      </Section>

      <Section name="TokenCard" maps="Wallet asset row (TokenRow) — used in the Tokens tab" {...sec} innerPadH={14}>
        <TokenRow r={SAMPLE_TOKEN} head={head} sub={sub} border={border} bg={bg} onPress={() => {}} />
      </Section>

      <Section name="MessageRow" maps="Chat message row (MessengerBubble) — used in the conversation feed" {...sec} innerPadV={6}>
        <MessengerBubble entry={SAMPLE_INCOMING} dark={dark} unread={false} myUri={SAMPLE_MY_URI} senderEthAddress={SAMPLE_USER_ADDR} />
        <MessengerBubble
          entry={SAMPLE_OUTGOING} dark={dark} unread={false} myUri={SAMPLE_MY_URI}
          senderEthAddress={SAMPLE_SELF_ADDR} reactions={new Map([['👍', 2], ['🚀', 1]])}
        />
      </Section>

      <Section name="Composer" maps="Message composer (MessengerComposer) — default empty state" {...sec}>
        <MessengerComposer dark={dark} xmtpLine={SAMPLE_XMTP_LINE} />
      </Section>
    </Box>
  );
}
