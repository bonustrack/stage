
import { memo, useMemo } from 'react';
import { Pressable } from '@stage-labs/kit/react-native/pressable';

import { Text } from '@stage-labs/kit/react-native/text';
import { Icon, type HeroIconName } from '@stage-labs/kit/react-native/icon';
import { Button } from '@stage-labs/kit/react-native/button';
import { ChatKitRenderer } from '@stage-labs/kit/react-native/chatkit-renderer';
import type {
  BasicNode,
  WidgetActionRegistry,
  WidgetRoot,
} from '@stage-labs/kit/chatkit';
import { tokenRowBody, WALLET_TOKEN_PRESS } from '@stage-labs/views';
import { Box, Col, Row } from '../layout';
import { type AssetRow } from './WalletScreen.assets';
import { TokenAvatar } from './WalletScreen.tokenAvatar';

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

function tokenRowNode(r: AssetRow): WidgetRoot {
  const valueUsd = r.priceUsd === null ? null : r.priceUsd * Number(r.balance);
  const priceText = r.priceUsd === null ? r.symbol : fmtUsd(r.priceUsd, r.priceUsd < 1 ? 4 : 2);
  const changeText = r.change24h === null ? '' : `${r.change24h >= 0 ? '+' : ''}${r.change24h.toFixed(2)}%`;
  const body: BasicNode = {
    type: 'Basic',
    children: [
      tokenRowBody({
        tokenId: `${r.chainId}:${r.symbol}`,
        symbol: r.name,
        name: priceText,
        priceUsd: `${fmtBalance(r.balance)} ${r.symbol}`,
        balance: valueUsd === null ? '—' : fmtUsd(valueUsd),
        change24h: changeText,
        logoUri: r.logoUrl,
        isPrivate: r.isPrivate,
        showAvatar: false,
        trailingChevron: false,
      }),
    ],
  };
  return body;
}

export const TokenRow = memo(function TokenRow({ r, border, bg, onPress }: { r: AssetRow; onPress?: () => void } & Omit<Palette, 'card'>): React.ReactElement {
  const node = useMemo(() => tokenRowNode(r), [r]);
  const registry: WidgetActionRegistry = useMemo(
    () => ({ [WALLET_TOKEN_PRESS]: () => { onPress?.(); } }),
    [onPress],
  );
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
      <Row padding={{ y: 14 }} align="center" gap={12}>
        <TokenAvatar logoUrl={r.logoUrl} chainId={r.chainId} bg={bg} border={border} />
        <Box flex={1}>
          <ChatKitRenderer node={node} registry={registry} />
        </Box>
      </Row>
    </Pressable>
  );
});

export { NftsView } from './WalletScreen.nfts';
