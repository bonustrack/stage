/** Wallet tab — identity header, asset list (ETH + stablecoins) with live USD
 *  prices via CoinGecko Pro, and Send / Receive shortcuts. Balances come from a
 *  single Multicall3 round-trip via the brovider RPC. Each row is 4-corner: name
 *  + price/24h-change left, USD value + amount/symbol right. */

import { useEffect, useRef, useState } from 'react';
import { fontSize } from '@metro-labs/kit/tokens';
import { ScrollView } from 'react-native-gesture-handler';
import { usePullToRefresh } from './PullToRefresh';
import { RefreshButton } from './WalletScreen.refreshButton';
import { CopyButton } from './WalletScreen.copyButton';
import { Spinner } from '../Spinner';
import type { SimultaneousRefs } from '../SwipeTabs.types';
import { Text } from '@metro-labs/kit/text';
import { useRouter } from 'expo-router';
import { flash } from '../../lib/toast';
import { usePeerProfiles } from '../../lib/peerProfiles';
import { DANGER, useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { Box, Col, Row } from '../layout';
import { TopnavIdentity } from '../TopnavIdentity';
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

export function WalletScreen({ panRef }: { panRef?: SimultaneousRefs } = {}): React.ReactElement {
  const router = useRouter();
  const { link: head, text: sub, bg, border, toolbarBg } = usePalette();
  const dark = useEffectiveColorScheme() === 'dark';

  const { snapshot: privSnapshot, accountId: privAccountId, pending } = usePrivateWallet(true);
  const { address, rows, err, refreshing, onRefresh } = useWalletBalances(privAccountId);
  usePeerProfiles([address]);

  /** Custom JS-only pull-to-refresh — replaces RN's native RefreshControl, which
   *  stranded its spinner on Android inside this nested-gesture ScrollView. The
   *  indicator's visibility is bound solely to `refreshing` (guaranteed to clear
   *  via try/finally + 8s hardStop in balances.ts), so it can never wedge. */
  const pull = usePullToRefresh(refreshing, onRefresh, head);

  /** Watch the EOA's mempool/nonce for an in-flight shield to the Railgun proxy
   *  so a shield arriving from anywhere (incl. external/cross-session, no local
   *  history) surfaces as a pending row. Cheap long-poll; only when the bridge is
   *  present (otherwise the private wallet isn't active on this build). */
  useEffect(() => {
    if (!privAccountId || !address || !isBridgeAvailable()) return;
    return startEoaShieldWatch(privAccountId, address);
  }, [privAccountId, address]);


  /** Shielded (Railgun) balances — reuses the Private tab's instant-paint hook
   *  (cached snapshot + pending overlay, no refetch), merged into the public
   *  Tokens list below as `isPrivate` rows. autoStart:true boots the Railgun
   *  engine here so private balances show without opening the Private tab — the
   *  SAME guarded path the Private tab uses (waitForXmtpReady + single-flight
   *  started/readyPromise), so a prior start makes this a no-op. */
  // ALWAYS render the fixed private row set (ETH/USDC × mainnet/Sepolia), even
  // pre-snapshot / pre-scan / at zero — pass the snapshot (may be null) so the
  // mapper seeds zero rows from the token registry then overlays live amounts.
  const privateRows = privateBalancesToRows(
    privSnapshot,
    symbolPricesFromPublic(rows ?? []),
  );

  /** Tokens | NFTs segmented toggle. NFTs are lazy-loaded: we only fetch on
   *  the first switch to the NFTs tab, then cache in `nfts` so toggling back
   *  and forth doesn't refetch. `nftStatus` drives the loading/error/empty UI. */
  const [tab, setTab] = useState<WalletTab>('tokens');

  /** Eagerly pre-warm the Railgun engine + prover + Groth16 artifacts in the
   *  background as soon as the wallet opens (behind the native guard, no-op when
   *  the module isn't linked) so hitting Send on the Private tab pays no
   *  cold-start cost — the proof can start immediately. */
  useEffect(() => { void prewarmRailgun(); }, []);
  const [nfts, setNfts] = useState<Nft[] | null>(null);
  const [nftStatus, setNftStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');

  // Guard re-fetch by the address we've already loaded for, NOT by `nftStatus`.
  // (If `nftStatus` were a dep, setting it to 'loading' would re-run the effect,
  //  whose cleanup flips `cancelled = true` on the in-flight run → the resolved
  //  fetch skips setNftStatus('ready') and the spinner spins forever.)
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
        setNfts(list);
        setNftStatus('ready');
      } catch {
        if (!cancelled) setNftStatus('error');
      }
    })();
    return () => { cancelled = true; };
  }, [tab, address]);

  const totalUsd = rows
    ? rows.reduce((s, r) => s + (r.priceUsd ?? 0) * Number(r.balance), 0)
    : null;

  return (
    /** RNGH ScrollView, simultaneous with the pager Pan (panRef). Pull-to-refresh
     *  is a pure-JS onScroll gesture (usePullToRefresh) — RN's native
     *  RefreshControl stranded its spinner on Android in this nested ScrollView.
     *  Wrapped in a flex:1 Box so the tap-to-refresh icon button can anchor to
     *  the screen top-right (absolute), independent of scroll content. */
    <Box style={{ flex: 1, backgroundColor: bg }}>
    <CopyButton address={address} color={head} />
    <RefreshButton refreshing={refreshing} onRefresh={onRefresh} color={head} />
    <ScrollView
      simultaneousHandlers={panRef}
      style={{ flex: 1, backgroundColor: bg }}
      contentContainerStyle={{ paddingBottom: 24, flexGrow: 1 }}
      /** bounces + alwaysBounceVertical + flexGrow:1 keep the list pullable even
       *  when content is shorter than the viewport — without bounce the swipe-down
       *  isn't an overscroll so the custom pull-to-refresh never fires.
       *  overScrollMode='always' enables Android overscroll; nestedScrollEnabled
       *  makes Android treat this as the scroller. The pager Pan gates on
       *  failOffsetY + simultaneous panRef, so the vertical pull is never
       *  swallowed by the horizontal tab-swipe. */
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
      {/* Topnav identity (avatar + name → Menu), left-aligned to match Home. */}
      <Row align="center" px={16} pt={12} pb={4} bg={toolbarBg}><TopnavIdentity /></Row>
      {/* Value card — compact, left-aligned: just the big total USD value.
          Decimals render in the dim `sub` colour to keep the dollars prominent. */}
      <Col mx={16} pt={20} pb={16} align="start">
        {err ? (
          <Text style={{ color: DANGER, fontSize: fontSize('sm'), fontFamily: 'Calibre-Medium' }}>
            Couldn’t load balances
          </Text>
        ) : totalUsd === null ? (
          <Text style={{ color: head, fontSize: fontSize('xxxl'), fontFamily: 'Calibre-Semibold' }}>…</Text>
        ) : (
          <Text style={{ color: head, fontSize: fontSize('xxxl'), fontFamily: 'Calibre-Semibold' }}>
            {splitUsd(fmtUsd(totalUsd)).int}
            <Text style={{ color: sub, fontSize: fontSize('xxxl'), fontFamily: 'Calibre-Semibold' }}>{splitUsd(fmtUsd(totalUsd)).dec}</Text>
          </Text>
        )}
      </Col>

      {/* Four action circles — Send / Receive route to existing screens;
          Swap / Buy are placeholders (no on/off-ramp wired yet) and flash a
          "coming soon" toast. LEFT-aligned on a single row (icon-over-label). */}
      <Row justify="start" gap={12} mx={16} mt={12}>
        <Btn icon="send" label="Send" onPress={() => router.push('/wallet/send')} head={head} border={border} dark={dark} />
        <Btn icon="arrowDown" label="Receive" onPress={() => router.push('/wallet/receive')} head={head} border={border} dark={dark} />
        <Btn icon="switchHorizontal" label="Swap" onPress={() => flash('Swap — coming soon')} head={head} border={border} dark={dark} />
        <Btn icon="creditCard" label="Buy" onPress={() => flash('Buy — coming soon')} head={head} border={border} dark={dark} />
      </Row>

      <WalletTabs tab={tab} setTab={setTab} head={head} sub={sub} border={border} />

      {tab === 'private' ? (
        <PrivateView head={head} sub={sub} border={border} />
      ) : tab === 'nfts' ? (
        <NftsView status={nftStatus} nfts={nfts} head={head} sub={sub} border={border} />
      ) : tab === 'activity' ? (
        <ActivityView address={address} head={head} sub={sub} border={border} bg={bg} />
      ) : err ? (
        <Col mx={16} py={40} align="center">
          <Text style={{ color: DANGER, fontSize: fontSize('md'), fontFamily: 'Calibre-Medium' }}>
            Couldn’t load tokens
          </Text>
        </Col>
      ) : rows === null ? (
        <Col mx={16} py={40} align="center">
          <Spinner size={28} color={head} />
        </Col>
      ) : (
      /* Asset list — ONE flat list (see WalletScreen.tokens: merged public +
         shielded rows, $-sorted, pending shields on top). */
      <TokensList
        rows={rows} privateRows={privateRows} pending={pending}
        head={head} sub={sub} border={border} bg={bg}
      />
      )}
    </ScrollView>
    </Box>
  );
}
