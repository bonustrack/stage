/** @file Wallet sub-components + formatting helpers — the action button (Btn), the Tokens|NFTs|Activity|Railgun tabs, and re-exported value formatters. */

import { memo } from 'react';
import { Pressable } from '@stage-labs/kit/pressable';

import { Text } from '@stage-labs/kit/text';
import { Icon, type HeroIconName } from '@stage-labs/kit/icon';
import { Button } from '@stage-labs/kit/button';
import { Col, Row } from '../layout';
import { type AssetRow } from './WalletScreen.assets';
import { TokenAvatar } from './WalletScreen.tokenAvatar';
import { DANGER } from '../../lib/theme';

/** Wallet value formatting (fmtUsd / splitUsd / fmtBalance) moved into the framework-agnostic Stage SDK (@stage-labs/client). Imported here (this file uses them) and re-exported so existing app imports stay stable. */
import { fmtUsd, splitUsd, fmtBalance } from '@stage-labs/client/wallet/format';
export { fmtUsd, splitUsd, fmtBalance };

interface Palette { head: string; sub: string; border: string; bg: string; card: string; }

/** Action button — a kit pill icon-only Button (56x56 circle, secondary fill + border) with its label as a separate Text below; Send/Receive/Swap/Buy sit left-aligned in one row of centered columns. */
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
        /** Override the kit's static secondary fill with the live `border` palette token so the circle reacts to theme/colour overrides (ChannelRow rowBg = border). */
        style={{ backgroundColor: border, borderColor: border }}
/>
      <Text weight="semibold" size="md" color={head} numberOfLines={1}>{label}</Text>
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
    <Row margin={{ x: 16, top: 22, bottom: 6 }} justify="start" gap={24} 
      style={{ borderBottomWidth: 1, borderBottomColor: border }}>
      {(['tokens', 'nfts', 'activity', 'private'] as const).map(t => {
        const active = tab === t;
        return (
          <Pressable
            key={t}
            onPress={() => { setTab(t); }}
            style={{
              paddingVertical: 10,
              marginBottom: -1,
              borderBottomWidth: 2,
              borderBottomColor: active ? head : 'transparent',
            }}
>
            <Text weight="semibold" size="3xl" color={active ? head : sub}>
              {TAB_LABEL[t]}
            </Text>
          </Pressable>
        );
      })}
    </Row>
  );
}

/** Small shield-check icon shown on Railgun-shielded token rows so they're visually distinct from public balances. Subtle muted glyph in the secondary text tone — quieter than a text pill, matches the app's metadata styling. */
function PrivateBadge({ sub }: { sub: string }): React.ReactElement {
  const name: HeroIconName = 'shieldCheck';
  return <Icon name={name} size={15} color={sub} />;
}

/** Derive the USD value + 24h change color/text for a token row. */
function tokenRowFields(r: AssetRow, sub: string): {
  valueUsd: number | null; changeColor: string; changeText: string;
} {
  const valueUsd = r.priceUsd === null ? null : r.priceUsd * Number(r.balance);
  /** Up/down colour for the 24h change pill (Snapshot treasury tones). */
  const changeColor = r.change24h === null ? sub : r.change24h >= 0 ? '#22c55e' : DANGER;
  const changeText = r.change24h === null ? '' : `${r.change24h >= 0 ? '+' : ''}${r.change24h.toFixed(2)}%`;
  return { valueUsd, changeColor, changeText };
}

/** A single asset row — 4-corner layout with token avatar + network badge. Tappable via `onPress` (wired by the caller). */
export const TokenRow = memo(function TokenRow({ r, head, sub, border, bg, onPress }: { r: AssetRow; onPress?: () => void } & Omit<Palette, 'card'>): React.ReactElement {
  const { valueUsd, changeColor, changeText } = tokenRowFields(r, sub);
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
    <Row padding={{ y: 14 }}
      align="center" gap={12} 
>
      {/* Shared TokenAvatar (token + network badge), reused by the private Activity rows so both read identically. */}
      <TokenAvatar logoUrl={r.logoUrl} chainId={r.chainId} bg={bg} border={border}/>
      {/* Left column — token name over price + 24h change; shielded rows carry a small Private pill next to the name. */}
      <Col minWidth={0} flex={1}>
        <Row minWidth={0} align="center" gap={6}>
          {r.isPrivate ? <PrivateBadge sub={sub} /> : null}
          <Text weight="semibold" size="4xl" color={head} numberOfLines={1}>{r.name}</Text>
        </Row>
        <Row margin={{ top: 2 }} align="center" gap={6}>
          <Text size="md" color={sub}>
            {r.priceUsd === null ? r.symbol : fmtUsd(r.priceUsd, r.priceUsd < 1 ? 4 : 2)}
          </Text>
          {changeText ? (
            <Text size="md" color={changeColor}>
              {changeText}
            </Text>
          ) : null}
        </Row>
      </Col>
      {/* Right column — USD VALUE (top, big/white) over amount + symbol (bottom). */}
      <Col align="end">
        <Text weight="semibold" size="4xl" color={head}>
          {valueUsd === null ? '—' : fmtUsd(valueUsd)}
        </Text>
        <Text size="md" color={sub} style={{ marginTop: 2 }}>
          {`${fmtBalance(r.balance)} ${r.symbol}`}
        </Text>
      </Col>
    </Row>
    </Pressable>
  );
});

/** NftsView lives in its own module; re-export so import paths are unchanged. */
export { NftsView } from './WalletScreen.nfts';
