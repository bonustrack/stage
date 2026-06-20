/** @file Wallet tab screen: identity header, asset list (ETH + stablecoins) with live CoinGecko USD prices, balances via a single Multicall3 round-trip, and Send / Receive shortcuts. */

import { useEffect, useMemo, useRef, useState } from 'react';

import { ScrollView } from 'react-native-gesture-handler';
import { usePullToRefresh } from './PullToRefresh';
import { RefreshButton } from './WalletScreen.refreshButton';
import { Spinner } from '../Spinner';
import type { SimultaneousRefs } from '../SwipeTabs.types';
import { Text } from '@metro-labs/kit/text';
import { useRouter } from 'expo-router';
import { flash } from '../../lib/toast';
import { usePeerProfiles } from '../../lib/peerProfiles';
import { DANGER, useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { Col, Row } from '../layout';
import { getNftsAcrossChains, type Nft } from '../../lib/opensea';
import { Btn, WalletTabs, NftsView, fmtUsd, splitUsd, type WalletTab } from './WalletScreen.parts';
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

/** Lazily-loaded NFT collection state for the Wallet NFTs tab. */
interface NftState { nfts: Nft[] | null; nftStatus: 'idle' | 'loading' | 'ready' | 'error' }

/** Lazy-load NFTs the first time the NFTs tab is opened for an address (cached after). */
function useWalletNfts(tab: WalletTab, address?: string): NftState {
  const [nfts, setNfts] = useState<Nft[] | null>(null);
  const [nftStatus, setNftStatus] = useState<NftState['nftStatus']>('idle');
  /** Guards re-fetch by the loaded address, not nftStatus, so 'loading' doesn't re-run the effect and cancel the in-flight fetch, wedging the spinner. */
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

/** Side effects gated on Wallet focus: EOA shield-watch + Railgun prewarm. */
function useWalletEffects(focused: boolean, privAccountId: string | null, address?: string): void {
  /** Watch the EOA mempool/nonce for an in-flight shield so it surfaces as a pending row. */
  useEffect(() => {
    if (!focused || !privAccountId || !address || !isBridgeAvailable()) return;
    return startEoaShieldWatch(privAccountId, address);
  }, [focused, privAccountId, address]);
  /** Pre-warm the Railgun engine/prover once focused so Send pays no cold-start cost. */
  useEffect(() => { if (focused) void prewarmRailgun(); }, [focused]);
}

/** Renders the active tab body: private / NFTs / activity / tokens (with err/loading states). */
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
  /** Asset list — ONE flat list (merged public + shielded rows, $-sorted, pending on top). */
  return <TokensList rows={rows} privateRows={privateRows} pending={pending} head={c.head} sub={c.sub} border={c.border} bg={c.bg}/>;
}

/** Renders the big total-USD balance card (error / loading / value states). */
function WalletBalanceCard({ err, totalUsd, head, sub }: {
  err: boolean; totalUsd: number | null; head: string; sub: string;
}): React.ReactElement {
  return (
    <Col padding={{ top: 4, bottom: 16 }} margin={{ x: 16 }} align="start">
      {err ? (
        <Text size="xs" color={DANGER}>Couldn’t load balances</Text>
      ) : totalUsd === null ? (
        <Text weight="semibold" size="7xl" color={head}>…</Text>
      ) : (
        <Text weight="semibold" size="7xl" color={head}>
          {splitUsd(fmtUsd(totalUsd)).int}
          <Text weight="semibold" size="7xl" color={sub}>{splitUsd(fmtUsd(totalUsd)).dec}</Text>
        </Text>
      )}
    </Col>
  );
}

/** Wallet tab screen showing balances, tokens, and activity. */
export function WalletScreen({ panRef }: { panRef?: SimultaneousRefs } = {}): React.ReactElement {
  const router = useRouter();
  const { link: head, text: sub, bg, border } = usePalette();
  const dark = useEffectiveColorScheme() === 'dark';
  /** Lazy Railgun boot: `focused` latches true on first focus (the pager mounts all tabs at once) so engine-booting side effects only run if Wallet is opened. */
  const focused = useWalletFocused();

  const { snapshot: privSnapshot, accountId: privAccountId, pending } = usePrivateWallet(focused);
  const { address, rows, err, refreshing, onRefresh } = useWalletBalances(privAccountId, focused);
  usePeerProfiles([address]);
  /** Custom JS-only pull-to-refresh (RN's RefreshControl strands its spinner here). */
  const pull = usePullToRefresh(refreshing, onRefresh, head);
  useWalletEffects(focused, privAccountId, address);

  /** ALWAYS render the fixed private row set; memoized so TokensList gets a stable ref. */
  const privateRows = useMemo(
    () => privateBalancesToRows(privSnapshot, symbolPricesFromPublic(rows ?? [])),
    [privSnapshot, rows],
  );
  const [tab, setTab] = useState<WalletTab>('tokens');
  const nftState = useWalletNfts(tab, address);

  const totalUsd = rows
    ? rows.reduce((s, r) => s + (r.priceUsd ?? 0) * Number(r.balance), 0)
    : null;
  const c = { head, sub, border, bg };

  return (
    /** RNGH ScrollView simultaneous with the pager Pan; pull-to-refresh is a pure-JS onScroll gesture (RN's RefreshControl stranded its spinner on Android here), wrapped in a flex:1 Col so the refresh icon can anchor top-right independent of scroll. */
    <Col surface="surface" flex={1}>
    {/* Shared Topnav is hoisted above the pager in (tabs)/_layout.tsx so it stays pinned on swipe and scroll; this body renders only the scroll content. */}
    <ScrollView
      simultaneousHandlers={panRef}
      style={{ flex: 1, backgroundColor: bg }}
      contentContainerStyle={{ paddingBottom: 24, flexGrow: 1 }}
      /** bounces + alwaysBounceVertical + flexGrow:1 keep the list pullable when content is shorter than the viewport, with overScrollMode/nestedScrollEnabled for Android; the pager Pan gates on failOffsetY + panRef so the vertical pull is never swallowed by the tab-swipe. */
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
      {/* Refresh anchored top-right of the balance area; copy-address now lives in the Home topnav 3-dots menu. */}
      <Row margin={{ x: 16, top: 8 }} justify="end" align="center" gap={18}>
        <RefreshButton refreshing={refreshing} onRefresh={onRefresh} color={head}/>
      </Row>
      {/* Value card — compact, left-aligned: just the big total USD value. */}
      <WalletBalanceCard err={!!err} totalUsd={totalUsd} head={head} sub={sub} />

      {/* Four action circles: Send/Receive route to existing screens; Swap/Buy are placeholders that flash a "coming soon" toast, left-aligned on a single row. */}
      <Row margin={{ x: 16, top: 12 }} justify="start" gap={12}>
        <Btn icon="send" label="Send" onPress={() => { router.push('/wallet/send'); }} head={head} border={border} dark={dark}/>
        <Btn icon="arrowDown" label="Receive" onPress={() => { router.push('/wallet/receive'); }} head={head} border={border} dark={dark}/>
        <Btn icon="switchHorizontal" label="Swap" onPress={() => { flash('Swap — coming soon'); }} head={head} border={border} dark={dark}/>
        <Btn icon="creditCard" label="Buy" onPress={() => { flash('Buy — coming soon'); }} head={head} border={border} dark={dark}/>
      </Row>

      <WalletTabs tab={tab} setTab={setTab} head={head} sub={sub} border={border}/>

      <WalletTabBody
        tab={tab} nftState={nftState} address={address} rows={rows}
        privateRows={privateRows} pending={pending} err={!!err} c={c}
      />
    </ScrollView>
    </Col>
  );
}
