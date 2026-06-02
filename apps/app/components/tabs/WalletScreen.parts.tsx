/** Wallet sub-components + formatting helpers — TokenRow, NftsView, the action
 *  button, the Tokens|NFTs tabs. Extracted from WalletScreen for lint
 *  line-budget. Rendering identical. */

import { Image, Pressable } from 'react-native';
import { Text } from '@metro-labs/kit/text';
import { Icon, type HeroIconName } from '@metro-labs/kit/icon';
import { Button } from '@metro-labs/kit/button';
import { Col, Row, Box } from '../layout';
import { NETWORK_LOGO, MAINNET_NETWORK_LOGO, type AssetRow } from './WalletScreen.assets';

/** Plain `$` (no `US`). `currencyDisplay: 'narrowSymbol'` still resolves to
 *  `US$` on `en-US` system locales (Android default) — we explicitly request
 *  `en` to get the bare `$` symbol, then strip any stray `US` prefix as a
 *  belt-and-suspenders for locales that ignore the hint. */
export const fmtUsd = (v: number, maxFrac = 2): string => {
  const s = v.toLocaleString('en', {
    style: 'currency', currency: 'USD',
    currencyDisplay: 'narrowSymbol',
    maximumFractionDigits: maxFrac,
  });
  return s.replace(/^US\$/, '$');
};
/** Split a formatted USD string into its integer part (incl. currency symbol +
 *  grouping) and its decimal fraction (incl. the leading `.`), so the decimals
 *  can render in a dimmer colour. Returns `dec: ''` when there are no decimals. */
export const splitUsd = (s: string): { int: string; dec: string } => {
  const i = s.lastIndexOf('.');
  return i === -1 ? { int: s, dec: '' } : { int: s.slice(0, i), dec: s.slice(i) };
};
export const fmtBalance = (v: string): string => {
  const n = Number(v);
  /** Tighter precision for big numbers; more for dust. Keeps the row clean
   *  without dropping informative digits on, say, 0.0034 ETH. */
  const max = n >= 1 ? 4 : 6;
  return n.toLocaleString(undefined, { maximumFractionDigits: max });
};

interface Palette { head: string; sub: string; border: string; bg: string; card: string; }

/** Action button — a kit `pill` icon-only Button rendering a 56×56 circle
 *  (`size="xl"`, `variant="secondary"` = rowBg fill + border), with the text
 *  label as a separate <Text> BELOW the circle. The four actions (Send /
 *  Receive / Swap / Buy) sit LEFT-aligned on a single row, centered columns. */
export function Btn({ icon, label, onPress, head, dark }: {
  icon: HeroIconName; label: string; onPress: () => void; head: string; dark: boolean;
}): React.ReactElement {
  return (
    <Col align="center" gap={6}>
      <Button
        variant="secondary"
        size="xl"
        pill
        dark={dark}
        onPress={onPress}
        icon={<Icon name={icon} size={26} color={head} />}
      />
      <Text style={{ color: head, fontSize: 14, fontFamily: 'Calibre-Semibold' }} numberOfLines={1}>{label}</Text>
    </Col>
  );
}

export type WalletTab = 'tokens' | 'nfts' | 'private';
const TAB_LABEL: Record<WalletTab, string> = { tokens: 'Tokens', nfts: 'NFTs', private: 'Private' };

/** Tokens | NFTs | Private underline tabs — Snapshot-treasury style. */
export function WalletTabs({ tab, setTab, head, sub, border }: {
  tab: WalletTab; setTab: (t: WalletTab) => void; head: string; sub: string; border: string;
}): React.ReactElement {
  return (
    <Row justify="start" gap={24} mx={16} mt={22} mb={6}
      style={{ borderBottomWidth: 1, borderBottomColor: border }}>
      {(['tokens', 'nfts', 'private'] as const).map(t => {
        const active = tab === t;
        return (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            style={{
              paddingVertical: 10,
              marginBottom: -1,
              borderBottomWidth: 2,
              borderBottomColor: active ? head : 'transparent',
            }}
          >
            <Text style={{ color: active ? head : sub, fontSize: 18, fontFamily: 'Calibre-Semibold' }}>
              {TAB_LABEL[t]}
            </Text>
          </Pressable>
        );
      })}
    </Row>
  );
}

/** A single asset row — 4-corner layout with token avatar + network badge. */
export function TokenRow({ r, head, sub, border, bg }: { r: AssetRow } & Omit<Palette, 'card'>): React.ReactElement {
  const valueUsd = r.priceUsd === null ? null : r.priceUsd * Number(r.balance);
  /** Up/down colour for the 24h change pill — green for non-negative,
   *  red for negative. Uses the same tones as Snapshot UI's treasury. */
  const changeColor = r.change24h === null ? sub : r.change24h >= 0 ? '#22c55e' : '#d96868';
  const changeText = r.change24h === null ? '' :
    `${r.change24h >= 0 ? '+' : ''}${r.change24h.toFixed(2)}%`;
  return (
    <Row
      align="center" gap={12} py={14}
      style={{
        borderBottomWidth: 1, borderBottomColor: border,
      }}
    >
      {/* Token avatar with a small mainnet network-bullet overlay, like
          Snapshot UI treasury. `resizeMode: contain` so the IPFS logo
          isn't cropped/zoomed inside the small badge slot. */}
      <Box style={{ width: 32, height: 32 }}>
        <Image
          source={{ uri: r.logoUrl }}
          style={{ width: 32, height: 32, borderRadius: 999, backgroundColor: border }}
        />
        {/* Network badge — round chip with a page-bg border ring; the logo
            FILLS the circle (cover) and is clipped to a full circle by the
            chip's overflow, so a square logo (e.g. Base) renders as a circle
            just like Ethereum — identical style for every network. */}
        <Box style={{
          position: 'absolute', right: -3, bottom: -3,
          width: 18, height: 18, borderRadius: 999,
          borderWidth: 2.5, borderColor: bg, backgroundColor: border,
          overflow: 'hidden',
        }}>
          <Image
            source={{ uri: NETWORK_LOGO[r.chainId] ?? MAINNET_NETWORK_LOGO }}
            resizeMode="cover"
            style={{ width: '100%', height: '100%' }}
          />
        </Box>
      </Box>
      {/* Left column — token NAME (top) over price + 24h change (bottom). */}
      <Col flex={1} style={{ minWidth: 0 }}>
        <Text style={{ color: head, fontSize: 18, fontFamily: 'Calibre-Semibold' }} numberOfLines={1}>{r.name}</Text>
        <Row align="center" gap={6} mt={2}>
          <Text style={{ color: sub, fontSize: 15, fontFamily: 'Calibre-Medium' }}>
            {r.priceUsd === null ? r.symbol : fmtUsd(r.priceUsd, r.priceUsd < 1 ? 4 : 2)}
          </Text>
          {changeText ? (
            <Text style={{ color: changeColor, fontSize: 15, fontFamily: 'Calibre-Medium' }}>
              {changeText}
            </Text>
          ) : null}
        </Row>
      </Col>
      {/* Right column — USD VALUE (top, big/white) over amount + symbol (bottom). */}
      <Col align="end">
        <Text style={{ color: head, fontSize: 18, fontFamily: 'Calibre-Semibold' }}>
          {valueUsd === null ? '—' : fmtUsd(valueUsd)}
        </Text>
        <Text style={{ color: sub, fontSize: 15, fontFamily: 'Calibre-Medium', marginTop: 2 }}>
          {`${fmtBalance(r.balance)} ${r.symbol}`}
        </Text>
      </Col>
    </Row>
  );
}


// NftsView lives in its own module; re-export so import paths are unchanged.
export { NftsView } from './WalletScreen.nfts';
