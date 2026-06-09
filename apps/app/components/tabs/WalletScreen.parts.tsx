/** Wallet sub-components + formatting helpers — TokenRow, NftsView, the action
 *  button, the Tokens|NFTs tabs. Extracted from WalletScreen for lint
 *  line-budget. Rendering identical. */

import { Pressable } from '@metro-labs/kit/pressable';

import { Text } from '@metro-labs/kit/text';
import { Icon, type HeroIconName } from '@metro-labs/kit/icon';
import { Button } from '@metro-labs/kit/button';
import { Col, Row } from '../layout';
import { type AssetRow } from './WalletScreen.assets';
import { TokenAvatar } from './WalletScreen.tokenAvatar';
import { DANGER } from '../../lib/theme';

/** Wallet value formatting (fmtUsd / splitUsd / fmtBalance) moved into the
 *  framework-agnostic Stage SDK (@stage-labs/client). Imported here (this file
 *  uses them) and re-exported so existing app imports stay stable. */
import { fmtUsd, splitUsd, fmtBalance } from '@stage-labs/client/wallet/format';
export { fmtUsd, splitUsd, fmtBalance };

interface Palette { head: string; sub: string; border: string; bg: string; card: string; }

/** Action button — a kit `pill` icon-only Button rendering a 56×56 circle
 *  (`size="xl"`, `variant="secondary"` = rowBg fill + border), with the text
 *  label as a separate <Text> BELOW the circle. The four actions (Send /
 *  Receive / Swap / Buy) sit LEFT-aligned on a single row, centered columns. */
export function Btn({ icon, label, onPress, head, border, dark }: {
  icon: HeroIconName; label: string; onPress: () => void;
  head: string; border: string; dark: boolean;
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
        // Override the kit's static secondary fill with the live `border` palette
        // token so the circle reacts to theme/colour overrides like the rest of
        // the design system (ChannelRow rowBg = border).
        style={{ backgroundColor: border, borderColor: border }}
      />
      <Text weight="semibold" size="md" style={{ color: head }} numberOfLines={1}>{label}</Text>
    </Col>
  );
}

export type WalletTab = 'tokens' | 'nfts' | 'activity' | 'private';
const TAB_LABEL: Record<WalletTab, string> = { tokens: 'Tokens', nfts: 'NFTs', activity: 'Activity', private: 'Railgun' };

/** Tokens | NFTs | Activity | Private underline tabs — Snapshot-treasury style. */
export function WalletTabs({ tab, setTab, head, sub, border }: {
  tab: WalletTab; setTab: (t: WalletTab) => void; head: string; sub: string; border: string;
}): React.ReactElement {
  return (
    <Row justify="start" gap={24} mx={16} mt={22} mb={6}
      style={{ borderBottomWidth: 1, borderBottomColor: border }}>
      {(['tokens', 'nfts', 'activity', 'private'] as const).map(t => {
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
            <Text weight="semibold" size="lg" style={{ color: active ? head : sub }}>
              {TAB_LABEL[t]}
            </Text>
          </Pressable>
        );
      })}
    </Row>
  );
}

/** Small shield-check icon shown on Railgun-shielded token rows so they're
 *  visually distinct from public balances. Subtle muted glyph in the secondary
 *  text tone — quieter than a text pill, matches the app's metadata styling. */
function PrivateBadge({ sub }: { sub: string }): React.ReactElement {
  const name: HeroIconName = 'shieldCheck';
  return <Icon name={name} size={15} color={sub} />;
}

/** A single asset row — 4-corner layout with token avatar + network badge.
 *  Tappable: `onPress` navigates to the token detail screen (wired by the
 *  caller). Wrapped in a Pressable with a subtle pressed-opacity. */
export function TokenRow({ r, head, sub, border, bg, onPress }: { r: AssetRow; onPress?: () => void } & Omit<Palette, 'card'>): React.ReactElement {
  const valueUsd = r.priceUsd === null ? null : r.priceUsd * Number(r.balance);
  /** Up/down colour for the 24h change pill — green for non-negative,
   *  red for negative. Uses the same tones as Snapshot UI's treasury. */
  const changeColor = r.change24h === null ? sub : r.change24h >= 0 ? '#22c55e' : DANGER;
  const changeText = r.change24h === null ? '' :
    `${r.change24h >= 0 ? '+' : ''}${r.change24h.toFixed(2)}%`;
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
    <Row
      align="center" gap={12} py={14}
    >
      {/* Token avatar + network badge - shared TokenAvatar (Snapshot-treasury
          style), reused by the private Activity rows so both read identically. */}
      <TokenAvatar logoUrl={r.logoUrl} chainId={r.chainId} bg={bg} border={border} />
      {/* Left column — token NAME (top) over price + 24h change (bottom).
          Shielded rows carry a small "Private" pill next to the name. */}
      <Col flex={1} style={{ minWidth: 0 }}>
        <Row align="center" gap={6} style={{ minWidth: 0 }}>
          {r.isPrivate ? <PrivateBadge sub={sub} /> : null}
          <Text weight="semibold" size="xl" style={{ color: head }} numberOfLines={1}>{r.name}</Text>
        </Row>
        <Row align="center" gap={6} mt={2}>
          <Text size="md" style={{ color: sub }}>
            {r.priceUsd === null ? r.symbol : fmtUsd(r.priceUsd, r.priceUsd < 1 ? 4 : 2)}
          </Text>
          {changeText ? (
            <Text size="md" style={{ color: changeColor }}>
              {changeText}
            </Text>
          ) : null}
        </Row>
      </Col>
      {/* Right column — USD VALUE (top, big/white) over amount + symbol (bottom). */}
      <Col align="end">
        <Text weight="semibold" size="xl" style={{ color: head }}>
          {valueUsd === null ? '—' : fmtUsd(valueUsd)}
        </Text>
        <Text size="md" style={{ color: sub, marginTop: 2 }}>
          {`${fmtBalance(r.balance)} ${r.symbol}`}
        </Text>
      </Col>
    </Row>
    </Pressable>
  );
}

// NftsView lives in its own module; re-export so import paths are unchanged.
export { NftsView } from './WalletScreen.nfts';
