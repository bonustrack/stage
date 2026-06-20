
import { memo } from 'react';
import { Pressable } from '@stage-labs/kit/pressable';

import { Text } from '@stage-labs/kit/text';
import { Icon, type HeroIconName } from '@stage-labs/kit/icon';
import { Button } from '@stage-labs/kit/button';
import { Col, Row } from '../layout';
import { type AssetRow } from './WalletScreen.assets';
import { TokenAvatar } from './WalletScreen.tokenAvatar';
import { DANGER } from '../../lib/theme';

import { fmtUsd, splitUsd, fmtBalance } from '@stage-labs/client/wallet/format';
export { fmtUsd, splitUsd, fmtBalance };

interface Palette { head: string; sub: string; border: string; bg: string; card: string; }

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
        style={{ backgroundColor: border, borderColor: border }}
/>
      <Text weight="semibold" size="md" color={head} numberOfLines={1}>{label}</Text>
    </Col>
  );
}

export type WalletTab = 'tokens' | 'nfts' | 'activity' | 'private';
const TAB_LABEL: Record<WalletTab, string> = { tokens: 'Tokens', nfts: 'NFTs', activity: 'Activity', private: 'Railgun' };

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

function PrivateBadge({ sub }: { sub: string }): React.ReactElement {
  const name: HeroIconName = 'shieldCheck';
  return <Icon name={name} size={15} color={sub} />;
}

function tokenRowFields(r: AssetRow, sub: string): {
  valueUsd: number | null; changeColor: string; changeText: string;
} {
  const valueUsd = r.priceUsd === null ? null : r.priceUsd * Number(r.balance);
  const changeColor = r.change24h === null ? sub : r.change24h >= 0 ? '#22c55e' : DANGER;
  const changeText = r.change24h === null ? '' : `${r.change24h >= 0 ? '+' : ''}${r.change24h.toFixed(2)}%`;
  return { valueUsd, changeColor, changeText };
}

export const TokenRow = memo(function TokenRow({ r, head, sub, border, bg, onPress }: { r: AssetRow; onPress?: () => void } & Omit<Palette, 'card'>): React.ReactElement {
  const { valueUsd, changeColor, changeText } = tokenRowFields(r, sub);
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
    <Row padding={{ y: 14 }}
      align="center" gap={12} 
>
      {}
      <TokenAvatar logoUrl={r.logoUrl} chainId={r.chainId} bg={bg} border={border}/>
      {}
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
      {}
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

export { NftsView } from './WalletScreen.nfts';
