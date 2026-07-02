
import { memo, useMemo } from 'react';
import { Pressable } from '@stage-labs/kit/react-native/pressable';

import { ViewHost } from '@stage-labs/kit/react-native/view-host';
import type { PayloadHandlers, WidgetRoot } from '@stage-labs/kit/kit';
import {
  basicRoot,
  tokenRowBody,
  tokenRowModel,
  walletTabOptions,
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

export function WalletTabs({ tab, setTab, border }: {
  tab: WalletTab; setTab: (t: WalletTab) => void; head: string; sub: string; border: string;
}): React.ReactElement {
  const node = useMemo(
    () => basicRoot(walletTabs({
      value: tab,
      options: walletTabOptions({ privateTab: true }),
    })),
    [tab],
  );
  const actions: PayloadHandlers = useMemo(
    () => ({
      [WALLET_TAB_CHANGE]: (payload) => {
        const next = payload.walletTab;
        if (typeof next === 'string') setTab(next as WalletTab);
      },
    }),
    [setTab],
  );
  return (
    <Row margin={{ x: 16, top: 22, bottom: 6 }} justify="start"
      style={{ borderBottomWidth: 1, borderBottomColor: border }}>
      <ViewHost node={node} actions={actions} />
    </Row>
  );
}

function tokenRowNode(r: AssetRow): WidgetRoot {
  return basicRoot(tokenRowBody({
    ...tokenRowModel(r, { fmtUsd, fmtBalance }),
    showAvatar: false,
    trailingChevron: false,
  }));
}

export const TokenRow = memo(function TokenRow({ r, border, bg, onPress }: { r: AssetRow; onPress?: () => void } & Omit<Palette, 'card'>): React.ReactElement {
  const node = useMemo(() => tokenRowNode(r), [r]);
  const actions: PayloadHandlers = useMemo(
    () => ({ [WALLET_TOKEN_PRESS]: () => { onPress?.(); } }),
    [onPress],
  );
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
      <Row padding={{ y: 14 }} align="center" gap={12}>
        <TokenAvatar logoUrl={r.logoUrl} chainId={r.chainId} bg={bg} border={border} />
        <Box flex={1}>
          <ViewHost node={node} actions={actions} />
        </Box>
      </Row>
    </Pressable>
  );
});

export { NftsView } from './WalletScreen.nfts';
