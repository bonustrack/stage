
import { memo, useMemo } from 'react';
import { Pressable } from '@stage-labs/kit/react-native/pressable';

import { KitRenderer } from '@stage-labs/kit/react-native/kit-renderer';
import type {
  BasicNode,
  WidgetActionRegistry,
  WidgetRoot,
} from '@stage-labs/kit/kit';
import {
  basicRoot,
  tokenRowBody,
  walletTabs,
  WALLET_TAB_CHANGE,
  WALLET_TOKEN_PRESS,
} from '@stage-labs/views';
import { Box, Row } from '../layout';
import { type AssetRow } from './WalletScreen.assets';
import { TokenAvatar } from './WalletScreen.tokenAvatar';

import { fmtUsd, splitUsd, fmtBalance } from '@stage-labs/client/wallet/format';
export { fmtUsd, splitUsd, fmtBalance };

interface Palette { head: string; sub: string; border: string; bg: string; card: string; }

export type WalletTab = 'tokens' | 'nfts' | 'activity' | 'private';
const TAB_LABEL: Record<WalletTab, string> = { tokens: 'Tokens', nfts: 'NFTs', activity: 'Activity', private: 'Railgun' };
const WALLET_TAB_IDS: WalletTab[] = ['tokens', 'nfts', 'activity', 'private'];

export function WalletTabs({ tab, setTab, border }: {
  tab: WalletTab; setTab: (t: WalletTab) => void; head: string; sub: string; border: string;
}): React.ReactElement {
  const node = useMemo(
    () => basicRoot(walletTabs({
      value: tab,
      options: WALLET_TAB_IDS.map((t) => ({ value: t, label: TAB_LABEL[t] })),
    })),
    [tab],
  );
  const registry: WidgetActionRegistry = useMemo(
    () => ({
      [WALLET_TAB_CHANGE]: (action) => {
        const next = action.payload.walletTab;
        if (typeof next === 'string') setTab(next as WalletTab);
      },
    }),
    [setTab],
  );
  return (
    <Row margin={{ x: 16, top: 22, bottom: 6 }} justify="start"
      style={{ borderBottomWidth: 1, borderBottomColor: border }}>
      <KitRenderer node={node} registry={registry} />
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
          <KitRenderer node={node} registry={registry} />
        </Box>
      </Row>
    </Pressable>
  );
});

export { NftsView } from './WalletScreen.nfts';
