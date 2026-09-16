
import { useCallback, useState } from 'react';
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
import { useRouter } from 'expo-router';
import { capabilities } from '../../../lib/capabilities';
import { usePeerProfiles } from '../../../lib/peerProfiles';
import { DANGER, usePalette } from '../../../lib/theme';
import { Col, Row, ScreenScroll } from '../../layout';
import { useNfts, type NftState } from '../../../lib/useNfts';
import { WalletTabs, NftsView, fmtUsd, splitUsd, type WalletTab } from './parts';
import { TokensList } from './tokens';
import { ActivityView } from './activity';
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

function WalletTabBody({ tab, nftState, address, rows, err, c }: {
  tab: WalletTab; nftState: NftState; address?: string;
  rows: ReturnType<typeof useWalletBalances>['rows'];
  err: boolean; c: { head: string; sub: string; border: string; bg: string };
}): React.ReactElement {
  if (tab === 'nfts') return <NftsView status={nftState.nftStatus} nfts={nftState.nfts} head={c.head} sub={c.sub} border={c.border}/>;
  if (tab === 'activity') return <ActivityView address={address} head={c.head} border={c.border}/>;
  if (err) {
    return (
      <Col padding={{ y: 40 }} margin={{ x: 16 }} align="center">
        <Text size="md" color={DANGER}>Couldn’t load tokens</Text>
      </Col>
    );
  }
  if (rows === null) {
    return (
      <Col padding={{ y: 40 }} margin={{ x: 16 }} align="center"><Spinner size={28} color={c.head}/></Col>
    );
  }
  return <TokensList rows={rows} head={c.head} sub={c.sub} border={c.border} bg={c.bg}/>;
}

const HERO_ACTIONS: readonly (readonly [string, string, string])[] = [
  ['Send', 'send', 'send'],
  ['Receive', 'arrowDown', 'receive'],
  ['Swap', 'switchHorizontal', 'swap'],
  ['Buy', 'creditCard', 'buy'],
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
    <Col padding={{ top: 4, bottom: 16 }} margin={{ x: 16 }} align="start">
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

  const [tab, setTab] = useState<WalletTab>('tokens');
  const nftState = useNfts(tab === 'nfts', address);

  const totalUsd = walletTotalUsd(rows);
  const c = { head, sub, border, bg };

  const onWalletAction = useCallback((action: string): void => {
    if (action === 'send') router.push('/wallet/send');
    else if (action === 'receive') router.push('/wallet/receive');
    else if (action === 'swap') capabilities.toast('Swap — coming soon');
    else if (action === 'buy') capabilities.toast('Buy — coming soon');
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
      <Row margin={{ x: 16, top: 8 }} justify="end" align="center" gap={18}>
        <RefreshButton refreshing={refreshing} onRefresh={onRefresh} color={head}/>
      </Row>
      <WalletBalanceCard err={!!err} totalUsd={totalUsd} border={border} onAction={onWalletAction} />

      <WalletTabs tab={tab} setTab={setTab} border={border}/>

      <WalletTabBody tab={tab} nftState={nftState} address={address} rows={rows} err={!!err} c={c} />
    </ScreenScroll>
    </Col>
  );
}
