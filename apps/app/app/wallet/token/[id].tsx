import { useMemo } from 'react';
import { Pressable } from '@stage-labs/kit/react-native/pressable';

import { Text } from '@stage-labs/kit/react-native/text';
import { Icon } from '@stage-labs/kit/react-native/icon';
import { KitRenderer } from '@stage-labs/kit/react-native/kit-renderer';
import type { BasicNode, WidgetActionRegistry } from '@stage-labs/kit/kit';
import {
  walletActions,
  WALLET_ACTION_PRESS, type WalletActionButton,
} from '@stage-labs/views';
import { fmtUsd, fmtBalance } from '@stage-labs/client/wallet/format';
import { Col, Row } from '../../../components/layout';
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
  const valueUsd = r.priceUsd === null ? null : r.priceUsd * Number(r.balance);
  return {
    type: 'Basic',
    children: [
      {
        type: 'Col',
        align: 'start',
        gap: 6,
        children: [
          {
            type: 'Stack',
            width: 72,
            height: 72,
            children: [
              { type: 'Image', src: withStampDisplayPx(r.logoUrl, 72), size: 72, radius: 'full', background: palette.border },
              {
                type: 'Box',
                position: 'absolute',
                right: -2,
                bottom: -2,
                width: 30,
                height: 30,
                radius: 'full',
                background: palette.border,
                border: { size: 3, color: palette.bg },
                children: [
                  { type: 'Image', src: NETWORK_LOGO[r.chainId] ?? MAINNET_NETWORK_LOGO, fit: 'cover', width: '100%', height: '100%', radius: 'full' },
                ],
              },
            ],
          },
          {
            type: 'Row',
            align: 'center',
            gap: 6,
            margin: { top: 10 },
            children: [
              ...(r.isPrivate ? [{ type: 'Icon' as const, name: 'eyeOff', color: palette.sub, size: 'md' as const }] : []),
              { type: 'Title', value: r.name, size: '5xl', weight: 'semibold', color: 'link' },
            ],
          },
          {
            type: 'Box',
            radius: 'full',
            padding: { x: 10, y: 3 },
            border: { size: 1, color: palette.border },
            children: [{ type: 'Caption', value: NETWORK_LABEL[r.chainId] ?? `Chain ${r.chainId}`, color: 'secondary', size: 'sm' }],
          },
          { type: 'Title', value: `${fmtBalance(r.balance)} ${r.symbol}`, size: '6xl', weight: 'semibold', color: 'link', margin: { top: 14 } },
          { type: 'Text', value: valueUsd === null ? '—' : fmtUsd(valueUsd), size: 'md', color: 'secondary' },
          {
            type: 'Box',
            padding: { top: 18 },
            children: [walletActions({ gap: 36, actions: detailActions(r, symbol, palette.border) })],
          },
        ],
      },
    ],
  };
}

export default function TokenDetail(): React.ReactElement {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; row?: string }>();
  const { link: head, text: sub, bg, border } = usePalette();

  const r = parseRow(params.row);

  if (!r) {
    return (
      <Col surface="surface" flex={1}>
        <Header head={head} border={border} onBack={() => { router.back(); }} title="Token"/>
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
      <Header head={head} border={border} onBack={() => { router.back(); }} title={r.name}/>
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

function Header({ head, border, onBack, title }: {
  head: string; border: string; onBack: () => void; title: string;
}): React.ReactElement {
  const insets = useSafeAreaInsets();
  return (
    <Row surface="toolbar" padding={{ x: 12, top: 8 + insets.top, bottom: 8 }} align="center" gap={8} 
      style={{ borderBottomWidth: 1, borderBottomColor: border }}>
      <Pressable onPress={onBack} hitSlop={8} style={{ padding: 4 }}>
        <Icon name="arrowLeft" size={22} color={head}/>
      </Pressable>
      <Text weight="semibold" size="xl" color={head} style={{ flex: 1 }} numberOfLines={1}>
        {title}
      </Text>
    </Row>
  );
}
