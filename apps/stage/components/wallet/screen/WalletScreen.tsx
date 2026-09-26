
import { useCallback, useMemo } from 'react';
import { useActiveAccountRecord } from '../../../modules/messaging';
import { useAssetRows } from './data';
import { type AssetRow } from '@stage-labs/client/wallet/assets';

import { usePullToRefresh } from '../../tabs/PullToRefresh';
import { RefreshButton } from './refreshButton';
import { Spinner } from '../../Spinner';
import type { SimultaneousRefs } from '../../SwipeTabs.types';
import { Caption } from '@stage-labs/kit/react-native/caption';
import { Text } from '@stage-labs/kit/react-native/text';
import { Title } from '@stage-labs/kit/react-native/title';
import { walletHeroDisplay, walletTotalUsd } from './model';
import { WalletActionButton } from '../../widgets';
import type { CentralIcon } from '@stage-labs/kit/react-native/glyph';
import { IconArrowDown } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconArrowDown';
import { IconPaperPlane } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconPaperPlane';
import { useRouter } from 'expo-router';
import { usePeerProfiles } from '../../../lib/peerProfiles';
import { DANGER, usePalette } from '../../../lib/theme';
import { Box, Col, Row, ScreenScroll, PAGE_GUTTER } from '../../layout';
import { fmtUsd, splitUsd } from './parts';
import { TokensList } from './tokens';
import { listedNativeChains } from '../TokenSelector.model';
import { useWalletFocused } from '../../tabs/useWalletFocused';

interface WalletBalances {
  address: string;
  rows: AssetRow[] | null;
  err: string;
  refreshing: boolean;
  onRefresh: () => void;
}

export function useWalletBalances(focused: boolean): WalletBalances {
  const address = useActiveAccountRecord()?.address ?? '';
  const rows = useAssetRows(address, focused);
  const refetch = rows.refetch;

  const onRefresh = useCallback((): void => {
    if (!address) return;
    void refetch();
  }, [address, refetch]);

  return {
    address,
    rows: rows.data ?? null,
    err: rows.error ? rows.error.message : '',
    refreshing: rows.isRefetching,
    onRefresh,
  };
}

function WalletTokens({ rows, err, nativeChainIds, c }: {
  rows: WalletBalances['rows']; err: boolean; nativeChainIds: readonly number[];
  c: { head: string; sub: string; border: string; bg: string };
}): React.ReactElement {
  if (err) {
    return (
      <Col padding={{ y: 40 }} margin={{ x: PAGE_GUTTER }} align="center">
        <Text size="md" color={DANGER}>Couldn’t load tokens</Text>
      </Col>
    );
  }
  if (rows === null) {
    return (
      <Col padding={{ y: 40 }} margin={{ x: PAGE_GUTTER }} align="center"><Spinner size={28} color={c.head}/></Col>
    );
  }
  return (
    <Box margin={{ top: 16 }}>
      <TokensList rows={rows} head={c.head} sub={c.sub} border={c.border} bg={c.bg} nativeChainIds={nativeChainIds}/>
    </Box>
  );
}

const HERO_ACTIONS: readonly (readonly [string, CentralIcon, string])[] = [
  ['Send', IconPaperPlane, 'send'],
  ['Receive', IconArrowDown, 'receive'],
];

function HeroTitle({ value, color }: { value: string; color?: string }): React.ReactElement {
  return (
    <Title size="lg" hero="7xl" color={color}>
      {value}
    </Title>
  );
}

function WalletBalanceCard({ err, totalUsd, border, onAction }: {
  err: boolean; totalUsd: number | null; border: string;
  onAction: (action: string) => void;
}): React.ReactElement {
  const parts = totalUsd === null ? null : splitUsd(fmtUsd(totalUsd));
  const hero = walletHeroDisplay({ parts, error: err });
  return (
    <Col padding={{ top: 4, bottom: 16 }} margin={{ x: PAGE_GUTTER }} align="start">
      <Col gap={12}>
        <Row align="end">
          <HeroTitle value={hero.total} />
          {hero.totalDecimals === undefined ? null : (
            <HeroTitle value={hero.totalDecimals} color="secondary" />
          )}
        </Row>
        {hero.subtitle === undefined ? null : <Caption value={hero.subtitle} color="secondary" />}
        <Row gap={12} justify="start">
          {HERO_ACTIONS.map(([label, icon, action]) => (
            <WalletActionButton
              key={action}
              label={label}
              icon={icon}
              bg={border}
              onPress={() => { onAction(action); }}
            />
          ))}
        </Row>
      </Col>
    </Col>
  );
}

export function WalletScreen({ panRef }: { panRef?: SimultaneousRefs } = {}): React.ReactElement {
  const router = useRouter();
  const { link: head, text: sub, bg, border } = usePalette();
  const focused = useWalletFocused();

  const { address, rows, err, refreshing, onRefresh } = useWalletBalances(focused);
  usePeerProfiles([address]);
  const pull = usePullToRefresh(refreshing, onRefresh, head);

  const smart = useActiveAccountRecord()?.type === 'smart';
  const nativeChainIds = useMemo(() => listedNativeChains(smart), [smart]);

  const totalUsd = walletTotalUsd(rows);
  const c = { head, sub, border, bg };

  const onWalletAction = useCallback((action: string): void => {
    if (action === 'send') router.push('/wallet/send');
    else if (action === 'receive') router.push('/wallet/receive');
  }, [router]);

  return (
    <Col surface="surface" flex={1}>
    <ScreenScroll
      simultaneousHandlers={panRef}
      style={{ backgroundColor: bg }}
      contentContainerStyle={{ paddingBottom: 24, flexGrow: 1 }}
      bounces
      alwaysBounceVertical
      overScrollMode="always"
      nestedScrollEnabled
      onScroll={pull.onScroll}
      onScrollBeginDrag={pull.onScrollBeginDrag}
      onScrollEndDrag={pull.onScrollEndDrag}
      scrollEventThrottle={pull.scrollEventThrottle}
>
      {pull.indicator}
      <Row margin={{ x: PAGE_GUTTER, top: 8 }} justify="end" align="center" gap={18}>
        <RefreshButton refreshing={refreshing} onRefresh={onRefresh} color={head}/>
      </Row>
      <WalletBalanceCard err={!!err} totalUsd={totalUsd} border={border} onAction={onWalletAction} />

      <WalletTokens rows={rows} err={!!err} nativeChainIds={nativeChainIds} c={c} />
    </ScreenScroll>
    </Col>
  );
}
