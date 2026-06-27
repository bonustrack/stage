import { useMemo } from 'react';

import { Text } from '@stage-labs/kit/react-native/text';
import { KitRenderer } from '@stage-labs/kit/react-native/kit-renderer';
import type { BasicNode, WidgetActionRegistry } from '@stage-labs/kit/kit';
import {
  basicRoot, screenHeader, SCREEN_BACK,
  tokenDetailCard,
  WALLET_ACTION_PRESS, type WalletActionButton,
} from '@stage-labs/views';
import { tokenDetailViewModel } from '@stage-labs/client/wallet/tokenDetail';
import { Col } from '../../../components/layout';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePalette } from '../../../lib/theme';
import { NETWORK_LOGO, MAINNET_NETWORK_LOGO, type AssetRow } from '../../../components/tabs/WalletScreen.assets';
import { withStampDisplayPx } from '@stage-labs/kit/avatar';

const NETWORK_LABEL: Record<number, string> = { 1: 'Ethereum', 11155111: 'Sepolia' };

function parseRow(raw: string | undefined): AssetRow | null {
  if (typeof raw !== 'string') return null;
  try {
    const r = JSON.parse(raw) as Partial<AssetRow>;
    if (typeof r.symbol !== 'string' || typeof r.chainId !== 'number') return null;
    return r as AssetRow;
  } catch {
    return null;
  }
}

function detailActions(r: AssetRow, symbol: 'ETH' | 'USDC' | undefined, border: string): WalletActionButton[] {
  const mk = (label: string, icon: string, action: string): WalletActionButton => ({
    label, icon, pressType: WALLET_ACTION_PRESS, bg: border,
    payload: { action, symbol: symbol ?? r.symbol, chainId: String(r.chainId) },
  });
  if (r.isPrivate) {
    return [mk('Send', 'send', 'send-private'), mk('Unshield', 'eye', 'unshield')];
  }
  return [mk('Send', 'send', 'send'), mk('Shield', 'eyeOff', 'shield')];
}

function detailNode(r: AssetRow, symbol: 'ETH' | 'USDC' | undefined, palette: { sub: string; bg: string; border: string }): BasicNode {
  const vm = tokenDetailViewModel(r, { networkLabels: NETWORK_LABEL });
  return tokenDetailCard({
    logoSrc: withStampDisplayPx(r.logoUrl, 72),
    networkLogo: NETWORK_LOGO[r.chainId] ?? MAINNET_NETWORK_LOGO,
    networkLabel: vm.networkLabel,
    name: vm.name,
    balanceLabel: vm.balanceLabel,
    usdLabel: vm.usdLabel,
    borderColor: palette.border,
    bgColor: palette.bg,
    actions: detailActions(r, symbol, palette.border),
    actionsPadTop: 18,
    isPrivate: r.isPrivate,
    privateIconColor: palette.sub,
    nameRowMarginTop: 10,
    balanceMarginTop: 14,
  });
}

export default function TokenDetail(): React.ReactElement {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; row?: string }>();
  const { link: head, text: sub, bg, border, toolbarBg } = usePalette();
  const insets = useSafeAreaInsets();

  const r = parseRow(params.row);

  const headerNode = basicRoot(screenHeader({
    title: r ? r.name : 'Token',
    titleStyle: { kind: 'text', size: 'xl', weight: 'semibold', color: head, truncate: true, maxLines: 1 },
    backColor: head,
    safeTop: insets.top,
    padBottom: 8,
    surface: toolbarBg,
    borderColor: border,
  }));
  const headerRegistry: WidgetActionRegistry = {
    [SCREEN_BACK]: () => { router.back(); },
  };

  if (!r) {
    return (
      <Col surface="surface" flex={1}>
        <KitRenderer node={headerNode} registry={headerRegistry} />
        <Col padding={{ y: 40 }} margin={{ x: 16 }} align="center">
          <Text size="md" role="secondary">Token not found</Text>
        </Col>
      </Col>
    );
  }

  const symbol: 'ETH' | 'USDC' | undefined =
    r.symbol === 'ETH' ? 'ETH' : r.symbol === 'USDC' ? 'USDC' : undefined;

  return (
    <Col surface="surface" flex={1}>
      <KitRenderer node={headerNode} registry={headerRegistry} />
      <TokenDetailBody r={r} symbol={symbol} sub={sub} bg={bg} border={border} />
    </Col>
  );
}

function TokenDetailBody({ r, symbol, sub, bg, border }: {
  r: AssetRow; symbol: 'ETH' | 'USDC' | undefined; sub: string; bg: string; border: string;
}): React.ReactElement {
  const router = useRouter();
  const node = useMemo(() => detailNode(r, symbol, { sub, bg, border }), [r, symbol, sub, bg, border]);
  const registry: WidgetActionRegistry = useMemo(() => ({
    [WALLET_ACTION_PRESS]: (a) => {
      const sym = typeof a.payload.symbol === 'string' ? a.payload.symbol : r.symbol;
      const chainId = typeof a.payload.chainId === 'string' ? a.payload.chainId : String(r.chainId);
      if (a.payload.action === 'send-private') {
        router.push({ pathname: '/wallet/send', params: { symbol: sym, chainId, private: '1' } });
      } else if (a.payload.action === 'unshield') {
        router.push({ pathname: '/wallet/unshield', params: { symbol: sym, chainId } });
      } else if (a.payload.action === 'shield') {
        router.push({ pathname: '/wallet/shield', params: { symbol: sym, chainId } });
      } else if (a.payload.action === 'send') {
        router.push({ pathname: '/wallet/send', params: { symbol: r.symbol, chainId } });
      }
    },
  }), [router, r]);
  return (
    <Col padding={{ top: 28 }} margin={{ x: 16 }}>
      <KitRenderer node={node} registry={registry} />
    </Col>
  );
}
