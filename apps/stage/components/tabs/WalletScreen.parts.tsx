
import { Platform } from 'react-native';
import { memo } from 'react';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Tabs } from '@stage-labs/kit/react-native/tabs';
import { useKitScheme } from '@stage-labs/kit/react-native/theme-context';
import { tokenRowModel, walletTabOptions } from '@views';
import { Box, Row } from '../layout';
import { type AssetRow } from './WalletScreen.assets';
import { TokenAvatar } from './WalletScreen.tokenAvatar';
import { TokenRowBody } from '../wallet/TokenRowView';

import { fmtUsd, splitUsd, fmtBalance } from '@stage-labs/client/wallet/format';
export { fmtUsd, splitUsd, fmtBalance };

interface Palette { head: string; sub: string; border: string; bg: string; card: string; }

export type WalletTab = 'tokens' | 'nfts' | 'activity' | 'private';

export function WalletTabs({ tab, setTab, border }: {
  tab: WalletTab; setTab: (t: WalletTab) => void; head: string; sub: string; border: string;
}): React.ReactElement {
  const dark = useKitScheme() === 'dark';
  const options = walletTabOptions({ privateTab: Platform.OS !== 'web' })
    .map((o) => ({ value: o.value, label: o.label }));
  return (
    <Row margin={{ x: 16, top: 22, bottom: 6 }} justify="start"
      style={{ borderBottomWidth: 1, borderBottomColor: border }}>
      <Tabs
        value={tab}
        options={options}
        variant="underline"
        dark={dark}
        onChange={(next) => { setTab(next as WalletTab); }}
      />
    </Row>
  );
}

export const TokenRow = memo(function TokenRow({ r, border, bg, onPress }: { r: AssetRow; onPress?: () => void } & Omit<Palette, 'card'>): React.ReactElement {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
      <Row padding={{ y: 14 }} align="center" gap={12}>
        <TokenAvatar logoUrl={r.logoUrl} chainId={r.chainId} bg={bg} border={border} />
        <Box flex={1}>
          <TokenRowBody
            {...tokenRowModel(r, { fmtUsd, fmtBalance })}
            showAvatar={false}
            trailingChevron={false}
          />
        </Box>
      </Row>
    </Pressable>
  );
});

export { NftsView } from './WalletScreen.nfts';
