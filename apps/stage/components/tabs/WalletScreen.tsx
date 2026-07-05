
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ScrollView } from 'react-native-gesture-handler';
import { usePullToRefresh } from './PullToRefresh';
import { RefreshButton } from './WalletScreen.refreshButton';
import { Spinner } from '../Spinner';
import type { SimultaneousRefs } from '../SwipeTabs.types';
import { Caption } from '@stage-labs/kit/react-native/caption';
import { Text } from '@stage-labs/kit/react-native/text';
import { Title } from '@stage-labs/kit/react-native/title';
import { walletHeroDisplay, walletTotalUsd } from './WalletScreen.model';
import { WalletActionButton } from '../wallet/widgets';
import { useRouter } from 'expo-router';
import { flash } from '../../lib/toast';
import { usePeerProfiles } from '../../lib/peerProfiles';
import { DANGER, usePalette } from '../../lib/theme';
import { Col, Row } from '../layout';
import { getNftsAcrossChains, type Nft } from '../../lib/opensea';
import { WalletTabs, NftsView, fmtUsd, splitUsd, type WalletTab } from './WalletScreen.parts';
import { PrivateView } from './WalletScreen.private';
import { privateBalancesToRows, symbolPricesFromPublic } from './WalletScreen.private.rows';
import { usePrivateWallet } from '../../lib/railgun/usePrivateWallet';
import { prewarmRailgun } from '../../lib/railgun/engine';
import { startEoaShieldWatch } from '../../lib/railgun/eoaShieldWatch';
import { isBridgeAvailable } from '../../lib/railgun/bridge';
import { TokensList } from './WalletScreen.tokens';
import { ActivityView } from './WalletScreen.activity';
import { useWalletBalances } from './WalletScreen.balances';
import { useWalletFocused } from './useWalletFocused';

interface NftState { nfts: Nft[] | null; nftStatus: 'idle' | 'loading' | 'ready' | 'error' }

function useWalletNfts(tab: WalletTab, address?: string): NftState {
  const [nfts, setNfts] = useState<Nft[] | null>(null);
  const [nftStatus, setNftStatus] = useState<NftState['nftStatus']>('idle');
  const loadedAddrRef = useRef<string | null>(null);
  useEffect(() => {
    if (tab !== 'nfts' || !address || loadedAddrRef.current === address) return;
    loadedAddrRef.current = address;
    let cancelled = false;
    setNftStatus('loading');
    void (async (): Promise<void> => {
      try {
        const list = await getNftsAcrossChains(address);
        if (cancelled) return;
        setNfts(list); setNftStatus('ready');
      } catch { if (!cancelled) setNftStatus('error'); }
    })();
    return () => { cancelled = true; };
  }, [tab, address]);
  return { nfts, nftStatus };
}

function useWalletEffects(focused: boolean, privAccountId: string | null, address?: string): void {
  useEffect(() => {
    if (!focused || !privAccountId || !address || !isBridgeAvailable()) return;
    return startEoaShieldWatch(privAccountId, address);
  }, [focused, privAccountId, address]);
  useEffect(() => { if (focused) void prewarmRailgun(); }, [focused]);
}

function WalletTabBody({ tab, nftState, address, rows, privateRows, pending, err, c }: {
  tab: WalletTab; nftState: NftState; address?: string;
  rows: ReturnType<typeof useWalletBalances>['rows'];
  privateRows: ReturnType<typeof privateBalancesToRows>;
  pending: ReturnType<typeof usePrivateWallet>['pending'];
  err: boolean; c: { head: string; sub: string; border: string; bg: string };
}): React.ReactElement {
  if (tab === 'private') return <PrivateView head={c.head} sub={c.sub} border={c.border}/>;
  if (tab === 'nfts') return <NftsView status={nftState.nftStatus} nfts={nftState.nfts} head={c.head} sub={c.sub} border={c.border}/>;
  if (tab === 'activity') return <ActivityView address={address} head={c.head} sub={c.sub} border={c.border} bg={c.bg}/>;
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
  return <TokensList rows={rows} privateRows={privateRows} pending={pending} head={c.head} sub={c.sub} border={c.border} bg={c.bg}/>;
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

  const { snapshot: privSnapshot, accountId: privAccountId, pending } = usePrivateWallet(focused);
  const { address, rows, err, refreshing, onRefresh } = useWalletBalances(privAccountId, focused);
  usePeerProfiles([address]);
  const pull = usePullToRefresh(refreshing, onRefresh, head);
  useWalletEffects(focused, privAccountId, address);

  const privateRows = useMemo(
    () => privateBalancesToRows(privSnapshot, symbolPricesFromPublic(rows ?? [])),
    [privSnapshot, rows],
  );
  const [tab, setTab] = useState<WalletTab>('tokens');
  const nftState = useWalletNfts(tab, address);

  const totalUsd = walletTotalUsd(rows);
  const c = { head, sub, border, bg };

  const onWalletAction = useCallback((action: string): void => {
    if (action === 'send') router.push('/wallet/send');
    else if (action === 'receive') router.push('/wallet/receive');
    else if (action === 'swap') flash('Swap — coming soon');
    else if (action === 'buy') flash('Buy — coming soon');
  }, [router]);

  return (
    <Col surface="surface" flex={1}>
    {}
    <ScrollView
      simultaneousHandlers={panRef}
      style={{ flex: 1, backgroundColor: bg }}
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
      {}
      <Row margin={{ x: 16, top: 8 }} justify="end" align="center" gap={18}>
        <RefreshButton refreshing={refreshing} onRefresh={onRefresh} color={head}/>
      </Row>
      {}
      <WalletBalanceCard err={!!err} totalUsd={totalUsd} border={border} onAction={onWalletAction} />

      <WalletTabs tab={tab} setTab={setTab} head={head} sub={sub} border={border}/>

      <WalletTabBody
        tab={tab} nftState={nftState} address={address} rows={rows}
        privateRows={privateRows} pending={pending} err={!!err} c={c}
      />
    </ScrollView>
    </Col>
  );
}
