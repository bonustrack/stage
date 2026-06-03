/** Wallet tab — header with the logged-in identity, asset list (ETH +
 *  stablecoins) with live USD prices via CoinGecko Pro, and Send / Receive
 *  shortcuts. Balances are pulled in a single Multicall3 round-trip via the
 *  brovider RPC (the proxy Snapshot UI uses; viem's default public endpoint
 *  was failing in RN). Each row is a 4-corner layout: token name + price/24h-change
 *  on the left, USD value + amount/symbol on the right. */

import { useEffect, useRef, useState } from 'react';
import { ScrollView } from 'react-native-gesture-handler';
import { usePullToRefresh } from './PullToRefresh';
import { Spinner } from '../Spinner';
import type { SimultaneousRefs } from '../SwipeTabs';
import { Text } from '@metro-labs/kit/text';
import { useRouter } from 'expo-router';
import { flash } from '../../lib/toast';
import { usePeerProfiles } from '../../lib/peerProfiles';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
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
import { useWalletBalances } from './WalletScreen.balances';

export function WalletScreen({ panRef }: { panRef?: SimultaneousRefs } = {}): React.ReactElement {
  const router = useRouter();
  const { head, sub, bg, border } = usePalette();
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


  /** Shielded (Railgun) balances — reuses the same instant-paint hook the
   *  Private tab uses (cached snapshot + pending overlay, no refetch). They're
   *  merged into the public Tokens list below as `isPrivate` rows.
   *
   *  autoStart:true so the Tokens tab itself boots the Railgun engine and the
   *  user sees private balances WITHOUT having to open the Private tab. This is
   *  the SAME safe path the Private tab uses: usePrivateWallet gates the engine
   *  boot behind waitForXmtpReady() (nodejs-mobile starts only AFTER XMTP's
   *  Client.create settles), and the bridge's started/readyPromise guard keeps
   *  the boot single-flight, so a prior Private-tab start makes this a no-op. */
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
     *  RefreshControl stranded its spinner on Android in this nested ScrollView. */
    <ScrollView
      simultaneousHandlers={panRef}
      style={{ flex: 1, backgroundColor: bg }}
      contentContainerStyle={{ paddingBottom: 24, flexGrow: 1 }}
      /** alwaysBounceVertical + flexGrow:1 keep the list pullable even when the
       *  content is shorter than the viewport — without bounce the swipe-down
       *  isn't recognised as an overscroll so the custom pull-to-refresh
       *  (usePullToRefresh, onScroll-driven) never fires.
       *  nestedScrollEnabled lets
       *  Android treat this as the scrolling element. The pager Pan gates on
       *  failOffsetY and is declared simultaneous via panRef, so the vertical
       *  pull is never swallowed by the horizontal tab-swipe. */
      alwaysBounceVertical
      nestedScrollEnabled
      onScroll={pull.onScroll}
      onScrollEndDrag={pull.onScrollEndDrag}
      scrollEventThrottle={pull.scrollEventThrottle}
    >
      {pull.indicator}
      {/* Value card — compact, left-aligned. Just the big total USD value;
          the account header (avatar/name/address) and the "TOTAL VALUE ·
          ETHEREUM" label were dropped per review. Decimals render in the dim
          `sub` colour to keep the leading dollars prominent. */}
      <Col mx={16} pt={20} pb={16} align="start">
        {err ? (
          <Text style={{ color: '#d96868', fontSize: 13, fontFamily: 'Calibre-Medium' }}>
            Couldn’t load balances
          </Text>
        ) : totalUsd === null ? (
          <Text style={{ color: head, fontSize: 38, fontFamily: 'Calibre-Semibold' }}>…</Text>
        ) : (
          <Text style={{ color: head, fontSize: 38, fontFamily: 'Calibre-Semibold' }}>
            {splitUsd(fmtUsd(totalUsd)).int}
            <Text style={{ color: sub, fontSize: 38, fontFamily: 'Calibre-Semibold' }}>{splitUsd(fmtUsd(totalUsd)).dec}</Text>
          </Text>
        )}
      </Col>

      {/* Four action circles — Send / Receive route to existing screens;
          Swap / Buy are placeholders (no on/off-ramp wired yet) and flash a
          "coming soon" toast. LEFT-aligned on a single row (icon-over-label). */}
      <Row justify="start" gap={12} mx={16} mt={12}>
        <Btn icon="send" label="Send" onPress={() => router.push('/wallet/send')} head={head} dark={dark} />
        <Btn icon="arrowDown" label="Receive" onPress={() => router.push('/wallet/receive')} head={head} dark={dark} />
        <Btn icon="switchHorizontal" label="Swap" onPress={() => flash('Swap — coming soon')} head={head} dark={dark} />
        <Btn icon="creditCard" label="Buy" onPress={() => flash('Buy — coming soon')} head={head} dark={dark} />
      </Row>

      <WalletTabs tab={tab} setTab={setTab} head={head} sub={sub} border={border} />

      {tab === 'private' ? (
        <PrivateView head={head} sub={sub} border={border} />
      ) : tab === 'nfts' ? (
        <NftsView status={nftStatus} nfts={nfts} head={head} sub={sub} border={border} />
      ) : err ? (
        <Col mx={16} py={40} align="center">
          <Text style={{ color: '#d96868', fontSize: 15, fontFamily: 'Calibre-Medium' }}>
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
  );
}
