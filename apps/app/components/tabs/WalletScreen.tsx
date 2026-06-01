/** Wallet tab — header with the logged-in identity, asset list (ETH +
 *  stablecoins) with live USD prices via CoinGecko Pro, and Send / Receive
 *  shortcuts. Balances are pulled in a single Multicall3 round-trip via the
 *  brovider RPC (the proxy Snapshot UI uses; viem's default public endpoint
 *  was failing in RN). Each row is a 4-corner layout: token name + price/24h-change
 *  on the left, USD value + amount/symbol on the right. */

import { useEffect, useRef, useState } from 'react';
import { Image, Linking, Pressable } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { Spinner } from '../Spinner';
import type { SimultaneousRefs } from '../SwipeTabs';
import { Text } from '@metro-labs/kit/text';
import { Title } from '@metro-labs/kit/title';
import { createPublicClient, http, formatEther, formatUnits, type Hex, type Chain } from 'viem';
import { mainnet, base } from 'viem/chains';
import { useRouter } from 'expo-router';
import { getOrCreateXmtpClient } from '../../lib/xmtp';
import { flash } from '../../lib/toast';
import { usePeerProfiles } from '../../lib/peerProfiles';
import { usePalette } from '../../lib/theme';
import { getErc20UsdPrices, getSimplePrices } from '../../lib/coingecko';
import { Icon, type HeroIconName } from '@metro-labs/kit/icon';
import { Col, Row, Box } from '../layout';
import { stampTokenUrl, NATIVE_TOKEN_SENTINEL } from '@metro-labs/kit/avatar';
import { getNftsAcrossChains, type Nft } from '../../lib/opensea';

const MULTICALL3 = '0xcA11bde05977b3631167028862bE2a173976CA11' as const;

/** Asset registry — ETH + the two stablecoins Less called out in the review.
 *  `address: null` is the special "native" row; everything else is an ERC-20
 *  on Ethereum mainnet. `cgId` lets us hit the simple-price endpoint for ETH
 *  (the contract-price endpoint doesn't cover native coins).
 *
 *  `logoAddress` is the contract address used to fetch the token icon from
 *  `cdn.stamp.fyi` — Snapshot UI uses the canonical ETH sentinel for
 *  native ETH; stamp.fyi serves it from a curated set. */
interface Asset {
  symbol: string; name: string; decimals: number;
  /** Chain this asset lives on (1 = Ethereum, 8453 = Base). */
  chainId: number;
  address: Hex | null;
  logoAddress: string;
  cgId?: string;        // coingecko id for native price lookup
  /** CoinGecko asset-platform id for the contract-price endpoint
   *  (`ethereum`, `base`). Only set for ERC-20 rows. */
  cgPlatform?: string;
}
const ASSETS: Asset[] = [
  { symbol: 'ETH',  name: 'Ethereum',  decimals: 18, chainId: 1,    address: null, logoAddress: NATIVE_TOKEN_SENTINEL, cgId: 'ethereum' },
  { symbol: 'USDC', name: 'USD Coin',  decimals: 6,  chainId: 1,    address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', logoAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', cgPlatform: 'ethereum' },
  { symbol: 'ETH',  name: 'Ethereum',  decimals: 18, chainId: 8453, address: null, logoAddress: NATIVE_TOKEN_SENTINEL, cgId: 'ethereum' },
  { symbol: 'USDC', name: 'USD Coin',  decimals: 6,  chainId: 8453, address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', logoAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', cgPlatform: 'base' },
];
/** Network bullets — Ethereum is Snapshot's IPFS-hosted logo (the UI's
 *  `BadgeNetwork`); Base is the canonical brand mark. Keyed by chainId so the
 *  renderer can drop the right badge over each token avatar. */
const MAINNET_NETWORK_LOGO = 'https://ipfs.snapshot.box/ipfs/bafkreid7ndxh6y2ljw2jhbisodiyrhcy2udvnwqgon5wgells3kh4si5z4';
const BASE_NETWORK_LOGO = 'https://ipfs.snapshot.box/ipfs/bafkreid4ek4gnj6ccxl3yubwj2wr3d5t6dqelvvh4hv5wo5eldkqs725ri';
const NETWORK_LOGO: Record<number, string> = { 1: MAINNET_NETWORK_LOGO, 8453: BASE_NETWORK_LOGO };
const VIEM_CHAINS: Record<number, Chain> = { 1: mainnet, 8453: base };

const erc20Abi = [{
  name: 'balanceOf', type: 'function', stateMutability: 'view',
  inputs: [{ name: 'a', type: 'address' }],
  outputs: [{ name: 'b', type: 'uint256' }],
}] as const;
const multicall3Abi = [{
  name: 'getEthBalance', type: 'function', stateMutability: 'view',
  inputs: [{ name: 'a', type: 'address' }],
  outputs: [{ name: 'b', type: 'uint256' }],
}] as const;

interface AssetRow {
  symbol: string; name: string;
  /** Chain this row's asset lives on — drives the network badge + label. */
  chainId: number;
  /** Decimal-string balance (`formatUnits` output). */
  balance: string;
  /** USD price per unit, or null when CoinGecko didn't return this asset. */
  priceUsd: number | null;
  /** 24-hour percentage change for the asset's USD price. Shown beneath
   *  the per-unit price as +/-x.xx%. */
  change24h: number | null;
  /** Cached logo URL (stamp.fyi) so the renderer doesn't recompute on every row. */
  logoUrl: string;
}

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
        type Price = { usd: number; usd_24h_change?: number };

        /** Balances: one Multicall3 round-trip PER chain (brovider is multichain —
         *  the path segment is the chainId). Each chain batches ETH balance via
         *  getEthBalance + every ERC-20's balanceOf, and we run the chains in
         *  parallel. Returns a chainId → (per-asset raw balance) map. */
        const chainIds = [...new Set(ASSETS.map(a => a.chainId))];
        const balancesByChain = new Map<number, bigint[]>();
        await Promise.all(chainIds.map(async cid => {
          const chainAssets = ASSETS.filter(a => a.chainId === cid);
          const pub = createPublicClient({ chain: VIEM_CHAINS[cid]!, transport: http('https://rpc.brovider.xyz/' + cid) });
          const calls = chainAssets.map(a => a.address === null
            ? { address: MULTICALL3, abi: multicall3Abi, functionName: 'getEthBalance' as const, args: [addr as Hex] }
            : { address: a.address, abi: erc20Abi, functionName: 'balanceOf' as const, args: [addr as Hex] });
          const results = await pub.multicall({ contracts: calls });
          balancesByChain.set(cid, results.map(r => r.status === 'success' ? r.result as bigint : 0n));
        }));

        /** Prices: simple-price once for ETH (same asset price on every chain),
         *  plus the contract endpoint per CoinGecko platform for the ERC-20s. */
        const platforms = [...new Set(ASSETS.filter(a => a.cgPlatform).map(a => a.cgPlatform!))];
        const cgIds = [...new Set(ASSETS.filter(a => a.cgId).map(a => a.cgId!))];
        const [simplePrices, ...platformPriceList] = await Promise.all([
          getSimplePrices(cgIds).catch(() => ({} as Record<string, Price>)),
          ...platforms.map(p => getErc20UsdPrices(p, ASSETS.filter(a => a.cgPlatform === p).map(a => a.address!.toLowerCase()))
            .catch(() => ({} as Record<string, Price>))),
        ]);
        const tokenPricesByPlatform = new Map<string, Record<string, Price>>(
          platforms.map((p, i) => [p, platformPriceList[i]!]),
        );
        if (cancelled) return;

        const next: AssetRow[] = ASSETS.map(a => {
          const idx = ASSETS.filter(x => x.chainId === a.chainId).indexOf(a);
          const raw = balancesByChain.get(a.chainId)?.[idx] ?? 0n;
          const balance = a.address === null
            ? formatEther(raw)
            : formatUnits(raw, a.decimals);
          const priceRec: Price | undefined = a.address === null
            ? (a.cgId ? simplePrices[a.cgId] : undefined)
            : (a.cgPlatform ? tokenPricesByPlatform.get(a.cgPlatform)?.[a.address.toLowerCase()] : undefined);
          const priceUsd = priceRec?.usd ?? null;
          const change24h = typeof priceRec?.usd_24h_change === 'number' ? priceRec.usd_24h_change : null;
          return {
            symbol: a.symbol, name: a.name, chainId: a.chainId, balance, priceUsd, change24h,
            logoUrl: stampTokenUrl(a.chainId, a.logoAddress, 32),
          };
        });
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
  /** Plain `$` (no `US`). `currencyDisplay: 'narrowSymbol'` still resolves to
   *  `US$` on `en-US` system locales (Android default) — we explicitly request
   *  `en` to get the bare `$` symbol, then strip any stray `US` prefix as a
   *  belt-and-suspenders for locales that ignore the hint. */
  const fmtUsd = (v: number, maxFrac = 2): string => {
    const s = v.toLocaleString('en', {
      style: 'currency', currency: 'USD',
      currencyDisplay: 'narrowSymbol',
      maximumFractionDigits: maxFrac,
    });
    return s.replace(/^US\$/, '$');
  };
  const fmtBalance = (v: string): string => {
    const n = Number(v);
    /** Tighter precision for big numbers; more for dust. Keeps the row clean
     *  without dropping informative digits on, say, 0.0034 ETH. */
    const max = n >= 1 ? 4 : 6;
    return n.toLocaleString(undefined, { maximumFractionDigits: max });
  };

  /** Action button — a PERFECT CIRCLE (fixed 56×56, `borderRadius: 28`) holding
   *  just the icon, with the label BELOW it. The four actions (Send / Receive /
   *  Swap / Buy) sit LEFT-aligned on a single row, separated by a 12px gap. Each
   *  column is content-width (no `flex: 1` stretch) so the row starts at the
   *  16px content edge rather than spreading across the screen. */
  const Btn = ({ icon, label, onPress }: { icon: HeroIconName; label: string; onPress: () => void }): React.ReactElement => (
    <Col align="center" gap={6}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => ({
          width: 56, height: 56, borderRadius: 28,
          alignItems: 'center', justifyContent: 'center',
          backgroundColor: pressed ? border : card, borderWidth: 1, borderColor: border,
        })}
      >
        <Icon name={icon} size={26} color={head} />
      </Pressable>
      <Text style={{ color: head, fontSize: 14, fontFamily: 'Calibre-Semibold' }} numberOfLines={1}>{label}</Text>
    </Col>
  );

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
        <Btn icon="send" label="Send" onPress={() => router.push('/wallet/send')} />
        <Btn icon="arrowDown" label="Receive" onPress={() => router.push('/wallet/receive')} />
        <Btn icon="switchHorizontal" label="Swap" onPress={() => flash('Swap — coming soon')} />
        <Btn icon="creditCard" label="Buy" onPress={() => flash('Buy — coming soon')} />
      </Row>

      {/* Tokens | NFTs underline tabs — Snapshot-treasury style: a left-aligned
          row of text tabs sitting on a full-width hairline divider; the active
          tab gets a 2px bottom-border underline + head colour, inactive is
          muted with no underline. Default Tokens. */}
      <Row justify="start" gap={24} mx={16} mt={22} mb={6}
        style={{ borderBottomWidth: 1, borderBottomColor: border }}>
        {(['tokens', 'nfts'] as const).map(t => {
          const active = tab === t;
          return (
            <Pressable
              key={t}
              onPress={() => setTab(t)}
              style={{
                paddingVertical: 10,
                marginBottom: -1,
                borderBottomWidth: 2,
                borderBottomColor: active ? head : 'transparent',
              }}
            >
              <Text style={{ color: active ? head : sub, fontSize: 18, fontFamily: 'Calibre-Semibold' }}>
                {t === 'tokens' ? 'Tokens' : 'NFTs'}
              </Text>
            </Pressable>
          );
        })}
      </Row>

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
        {rows.map(r => {
          const valueUsd = r.priceUsd === null ? null : r.priceUsd * Number(r.balance);
          /** Up/down colour for the 24h change pill — green for non-negative,
           *  red for negative. Uses the same tones as Snapshot UI's treasury. */
          const changeColor = r.change24h === null ? sub : r.change24h >= 0 ? '#22c55e' : '#d96868';
          const changeText = r.change24h === null ? '' :
            `${r.change24h >= 0 ? '+' : ''}${r.change24h.toFixed(2)}%`;
          return (
            <Row
              key={`${r.chainId}:${r.symbol}`}
              align="center" gap={12} py={14}
              style={{
                borderBottomWidth: 1, borderBottomColor: border,
              }}
            >
              {/* Token avatar with a small mainnet network-bullet overlay, like
                  Snapshot UI treasury. `resizeMode: contain` so the IPFS logo
                  isn't cropped/zoomed inside the small badge slot. */}
              <Box style={{ width: 32, height: 32 }}>
                <Image
                  source={{ uri: r.logoUrl }}
                  style={{ width: 32, height: 32, borderRadius: 999, backgroundColor: border }}
                />
                {/* Network badge — exactly Snapshot UI's BadgeNetwork:
                    rounded-full + border-2 in the page bg color + bg = border token
                    (muted, NOT white). `contain` so the logo isn't cropped. */}
                <Image
                  source={{ uri: NETWORK_LOGO[r.chainId] ?? MAINNET_NETWORK_LOGO }}
                  resizeMode="contain"
                  style={{
                    position: 'absolute', right: -3, bottom: -3,
                    width: 16, height: 16, borderRadius: 999,
                    borderWidth: 2, borderColor: bg, backgroundColor: border,
                  }}
                />
              </Box>
              {/* Left column — token NAME (top) over price + 24h change (bottom). */}
              <Col flex={1} style={{ minWidth: 0 }}>
                <Text style={{ color: head, fontSize: 18, fontFamily: 'Calibre-Semibold' }} numberOfLines={1}>{r.name}</Text>
                <Row align="center" gap={6} mt={2}>
                  <Text style={{ color: sub, fontSize: 15, fontFamily: 'Calibre-Medium' }}>
                    {r.priceUsd === null ? r.symbol : fmtUsd(r.priceUsd, r.priceUsd < 1 ? 4 : 2)}
                  </Text>
                  {changeText ? (
                    <Text style={{ color: changeColor, fontSize: 15, fontFamily: 'Calibre-Medium' }}>
                      {changeText}
                    </Text>
                  ) : null}
                </Row>
              </Col>
              {/* Right column — USD VALUE (top, big/white) over amount + symbol (bottom). */}
              <Col align="end">
                <Text style={{ color: head, fontSize: 18, fontFamily: 'Calibre-Semibold' }}>
                  {valueUsd === null ? '—' : fmtUsd(valueUsd)}
                </Text>
                <Text style={{ color: sub, fontSize: 15, fontFamily: 'Calibre-Medium', marginTop: 2 }}>
                  {`${fmtBalance(r.balance)} ${r.symbol}`}
                </Text>
              </Col>
            </Row>
          );
        })}
      </Col>
      )}
    </ScrollView>
  );
}

/** NFT grid view — 2-column grid of the account's NFTs from OpenSea. Shows a
 *  spinner while loading, an error line on failure, an empty state when the
 *  account holds nothing, else a grid of image cells (remote https image_url,
 *  placeholder when missing) tappable to the NFT's OpenSea page. */
function NftsView({
  status, nfts, head, sub, border,
}: {
  status: 'idle' | 'loading' | 'ready' | 'error';
  nfts: Nft[] | null;
  head: string; sub: string; border: string;
}): React.ReactElement {
  if (status === 'loading' || status === 'idle') {
    return (
      <Col mx={16} py={40} align="center">
        <Spinner size={28} color={head} />
      </Col>
    );
  }
  if (status === 'error') {
    return (
      <Col mx={16} py={40} align="center">
        <Text style={{ color: '#d96868', fontSize: 15, fontFamily: 'Calibre-Medium' }}>
          Failed to load NFTs.
        </Text>
      </Col>
    );
  }
  if (!nfts || nfts.length === 0) {
    return (
      <Col mx={16} py={40} align="center">
        <Text style={{ color: sub, fontSize: 15, fontFamily: 'Calibre-Medium' }}>
          There are no NFTs in this wallet.
        </Text>
      </Col>
    );
  }
  return (
    <Row mx={16} mt={6} style={{ flexWrap: 'wrap' }}>
      {nfts.map(nft => (
        <Box key={`${nft.chainId}:${nft.id}`} style={{ width: '50%' }}>
          <Pressable
            onPress={() => { if (nft.openseaUrl) void Linking.openURL(nft.openseaUrl); }}
            style={({ pressed }) => ({ padding: 6, opacity: pressed ? 0.7 : 1 })}
          >
            {nft.image ? (
              <Image
                source={{ uri: nft.image }}
                resizeMode="cover"
                style={{ width: '100%', aspectRatio: 1, borderRadius: 12, backgroundColor: border }}
              />
            ) : (
              <Box
                style={{
                  width: '100%', aspectRatio: 1, borderRadius: 12,
                  backgroundColor: border, alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Icon name="photo" size={28} color={sub} />
              </Box>
            )}
            <Text
              numberOfLines={1}
              style={{ color: head, fontSize: 15, fontFamily: 'Calibre-Semibold', marginTop: 6 }}
            >
              {nft.title}
            </Text>
            {nft.collection ? (
              <Text numberOfLines={1} style={{ color: sub, fontSize: 13, fontFamily: 'Calibre-Medium' }}>
                {nft.collection}
              </Text>
            ) : null}
          </Pressable>
        </Box>
      ))}
    </Row>
  );
}
