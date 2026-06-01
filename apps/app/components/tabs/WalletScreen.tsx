/** Wallet tab — header with the logged-in identity, asset list (ETH +
 *  stablecoins) with live USD prices via CoinGecko Pro, and Send / Receive
 *  shortcuts. Balances are pulled in a single Multicall3 round-trip via the
 *  brovider RPC (the proxy Snapshot UI uses; viem's default public endpoint
 *  was failing in RN). Each row is a 4-corner layout: token name + price/24h-change
 *  on the left, USD value + amount/symbol on the right. */

import { useEffect, useRef, useState } from 'react';
import { ScrollView } from 'react-native-gesture-handler';
import { Spinner } from '../Spinner';
import type { SimultaneousRefs } from '../SwipeTabs';
import { Text } from '@metro-labs/kit/text';
import { Title } from '@metro-labs/kit/title';
import { useRouter } from 'expo-router';
import { getOrCreateXmtpClient } from '../../lib/xmtp';
import { flash } from '../../lib/toast';
import { usePeerProfiles } from '../../lib/peerProfiles';
import { usePalette } from '../../lib/theme';
import { Col, Row } from '../layout';
import { getNftsAcrossChains, type Nft } from '../../lib/opensea';
import { type AssetRow } from './WalletScreen.assets';
import { fetchAssetRows } from './WalletScreen.data';
import { Btn, WalletTabs, TokenRow, NftsView, fmtUsd } from './WalletScreen.parts';

export function WalletScreen({ panRef }: { panRef?: SimultaneousRefs } = {}): React.ReactElement {
  const router = useRouter();
  const { head, sub, bg, border, rowBg: card } = usePalette();

  const [address, setAddress] = useState<string>('');
  const [rows, setRows] = useState<AssetRow[] | null>(null);
  const [err, setErr] = useState<string>('');
  usePeerProfiles([address]);

  /** Tokens | NFTs segmented toggle. NFTs are lazy-loaded: we only fetch on
   *  the first switch to the NFTs tab, then cache in `nfts` so toggling back
   *  and forth doesn't refetch. `nftStatus` drives the loading/error/empty UI. */
  const [tab, setTab] = useState<'tokens' | 'nfts'>('tokens');
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

  useEffect(() => {
    let cancelled = false;
    void (async (): Promise<void> => {
      try {
        const client = await getOrCreateXmtpClient('production');
        const addr = client.publicIdentity.identifier;
        if (cancelled) return;
        setAddress(addr);
        const next = await fetchAssetRows(addr);
        if (cancelled) return;
        setRows(next);
      } catch (e) {
        if (!cancelled) setErr((e as Error).message);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const totalUsd = rows
    ? rows.reduce((s, r) => s + (r.priceUsd ?? 0) * Number(r.balance), 0)
    : null;

  return (
    <ScrollView simultaneousHandlers={panRef} style={{ flex: 1, backgroundColor: bg }} contentContainerStyle={{ paddingBottom: 24 }}>
      <Col px={16} pt={16} pb={8}>
        <Title style={{ color: head, fontSize: 22 }}>Wallet</Title>
      </Col>

      {/* Value card — compact, left-aligned. Just the big total USD value;
          the account header (avatar/name/address) and the "TOTAL VALUE ·
          ETHEREUM" label were dropped per review. */}
      <Col mx={16} mt={8} py={16} align="start">
        {err ? (
          <Text style={{ color: '#d96868', fontSize: 13, fontFamily: 'Calibre-Medium' }}>
            Couldn’t load balances
          </Text>
        ) : (
          <Text style={{ color: head, fontSize: 34, fontFamily: 'Calibre-Semibold' }}>
            {totalUsd === null ? '…' : fmtUsd(totalUsd)}
          </Text>
        )}
      </Col>

      {/* Four action pills — Send / Receive route to existing screens;
          Top up / Buy are placeholders (no on/off-ramp wired yet) and flash a
          "coming soon" toast. Single row, LEFT-aligned, 12px gap between buttons. */}
      <Row justify="start" gap={12} mx={16} mt={12}>
        <Btn icon="send" label="Send" onPress={() => router.push('/wallet/send')} head={head} border={border} card={card} />
        <Btn icon="arrowDown" label="Receive" onPress={() => router.push('/wallet/receive')} head={head} border={border} card={card} />
        <Btn icon="switchHorizontal" label="Swap" onPress={() => flash('Swap — coming soon')} head={head} border={border} card={card} />
        <Btn icon="creditCard" label="Buy" onPress={() => flash('Buy — coming soon')} head={head} border={border} card={card} />
      </Row>

      <WalletTabs tab={tab} setTab={setTab} head={head} sub={sub} border={border} />

      {tab === 'nfts' ? (
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
      /* Asset list — Snapshot-treasury-style rows, border-bottom separators. */
      <Col mx={16}>
        {rows.map(r => (
          <TokenRow key={`${r.chainId}:${r.symbol}`} r={r} head={head} sub={sub} border={border} bg={bg} />
        ))}
      </Col>
      )}
    </ScrollView>
  );
}
