/** Wallet tab — header with the logged-in identity, asset list (ETH +
 *  stablecoins) with live USD prices via CoinGecko Pro, and Send / Receive
 *  shortcuts. Balances are pulled in a single Multicall3 round-trip via the
 *  brovider RPC (the proxy Snapshot UI uses; viem's default public endpoint
 *  was failing in RN). The row layout mirrors Snapshot UI's treasury page:
 *  bordered rows, symbol + name on the left, balance + USD value on the right. */

import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { createPublicClient, http, formatEther, formatUnits, type Hex } from 'viem';
import { mainnet } from 'viem/chains';
import { useRouter } from 'expo-router';
import { getOrCreateXmtpClient, shortAddress } from '../../lib/xmtp';
import { usePeerProfiles, getPeerName, getPeerAvatarCb } from '../../lib/peerProfiles';
import { useEffectiveColorScheme } from '../../lib/theme';
import { getErc20UsdPrices, getSimplePrices } from '../../lib/coingecko';
import { HeroIcon, type HeroIconName } from '../../components/HeroIcon';
import { Avatar } from '../../components/Avatar';
import { stampTokenUrl, NATIVE_TOKEN_SENTINEL } from '@metro-labs/kit/avatar';

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
  address: Hex | null;
  logoAddress: string;
  cgId?: string;        // coingecko id for native price lookup
}
const ASSETS: Asset[] = [
  { symbol: 'ETH',  name: 'Ethereum',  decimals: 18, address: null, logoAddress: NATIVE_TOKEN_SENTINEL, cgId: 'ethereum' },
  { symbol: 'USDC', name: 'USD Coin',  decimals: 6,  address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', logoAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
  { symbol: 'USDT', name: 'Tether USD', decimals: 6, address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', logoAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7' },
];
/** Mainnet network bullet — Snapshot's IPFS-hosted logo (same one used in
 *  the UI's `BadgeNetwork` over the IPFS gateway at `ipfs.snapshot.box`).
 *  Hardcoded so we don't need to pull snapshot.js's full networks.json. */
const MAINNET_NETWORK_LOGO = 'https://ipfs.snapshot.box/ipfs/bafkreid7ndxh6y2ljw2jhbisodiyrhcy2udvnwqgon5wgells3kh4si5z4';

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

export default function Wallet(): React.ReactElement {
  const router = useRouter();
  const dark = useEffectiveColorScheme() === 'dark';
  const head = dark ? '#ffffff' : '#000000';
  const sub = dark ? '#7a7a7e' : '#8a929d';
  const bg = dark ? '#0e0f10' : '#ffffff';
  const border = dark ? '#282a2d' : '#e4e4e5';
  const card = dark ? '#282a2d' : '#e4e4e5';

  const [address, setAddress] = useState<string>('');
  const [rows, setRows] = useState<AssetRow[] | null>(null);
  const [err, setErr] = useState<string>('');
  usePeerProfiles([address]);

  useEffect(() => {
    let cancelled = false;
    void (async (): Promise<void> => {
      try {
        const client = await getOrCreateXmtpClient('production');
        const addr = client.publicIdentity.identifier;
        if (cancelled) return;
        setAddress(addr);
        const pub = createPublicClient({ chain: mainnet, transport: http('https://rpc.brovider.xyz/1') });
        /** One Multicall3 batch: ETH balance via getEthBalance + every ERC-20's balanceOf. */
        const calls = ASSETS.map(a => a.address === null
          ? { address: MULTICALL3, abi: multicall3Abi, functionName: 'getEthBalance' as const, args: [addr as Hex] }
          : { address: a.address, abi: erc20Abi, functionName: 'balanceOf' as const, args: [addr as Hex] });
        const results = await pub.multicall({ contracts: calls });
        /** Prices in parallel: contract endpoint for ERC-20s, simple-price for ETH. */
        const erc20Addrs = ASSETS.filter(a => a.address).map(a => a.address!.toLowerCase());
        const cgIds = ASSETS.filter(a => a.cgId).map(a => a.cgId!);
        type Price = { usd: number; usd_24h_change?: number };
        const [tokenPrices, simplePrices] = await Promise.all([
          getErc20UsdPrices('ethereum', erc20Addrs).catch(() => ({} as Record<string, Price>)),
          getSimplePrices(cgIds).catch(() => ({} as Record<string, Price>)),
        ]);
        if (cancelled) return;
        const next: AssetRow[] = ASSETS.map((a, i) => {
          const r = results[i]!;
          const raw = r.status === 'success' ? r.result as bigint : 0n;
          const balance = a.address === null
            ? formatEther(raw)
            : formatUnits(raw, a.decimals);
          const priceRec: Price | undefined = a.address === null
            ? (a.cgId ? simplePrices[a.cgId] : undefined)
            : tokenPrices[a.address.toLowerCase()];
          const priceUsd = priceRec?.usd ?? null;
          const change24h = typeof priceRec?.usd_24h_change === 'number' ? priceRec.usd_24h_change : null;
          return {
            symbol: a.symbol, name: a.name, balance, priceUsd, change24h,
            logoUrl: stampTokenUrl(1, a.logoAddress, 48),
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

  const Btn = ({ icon, label, onPress }: { icon: HeroIconName; label: string; onPress: () => void }): React.ReactElement => (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
        flexDirection: 'row', gap: 8,
        backgroundColor: pressed ? border : card, borderWidth: 1, borderColor: border,
      })}
    >
      <HeroIcon name={icon} size={22} color={head} />
      <Text style={{ color: head, fontSize: 15, fontFamily: 'Calibre-Semibold' }}>{label}</Text>
    </Pressable>
  );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: bg }} contentContainerStyle={{ paddingBottom: 24 }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
        <Text style={{ color: head, fontSize: 22, fontFamily: 'Calibre-Semibold' }}>Wallet</Text>
      </View>

      {/* Identity card — avatar + name + tap-to-copy address + total USD value. */}
      <View style={{
        marginHorizontal: 16, marginTop: 8, padding: 20, borderRadius: 16,
        backgroundColor: card, borderWidth: 1, borderColor: border, alignItems: 'center',
      }}>
        <Avatar
          address={address || null}
          size="lg"
          cacheBuster={address ? getPeerAvatarCb(address) : undefined}
          style={{ backgroundColor: border }}
        />
        <Text style={{ color: head, fontSize: 17, fontFamily: 'Calibre-Semibold', marginTop: 12 }} numberOfLines={1}>
          {getPeerName(address) ?? (address ? shortAddress(address) : '—')}
        </Text>
        <Text style={{ color: sub, fontSize: 13, fontFamily: 'Calibre-Medium', marginTop: 2 }}>
          {address ? shortAddress(address) : ''}
        </Text>

        <Text style={{ color: sub, fontSize: 12, fontFamily: 'Calibre-Medium', marginTop: 20 }}>
          TOTAL VALUE · ETHEREUM
        </Text>
        {err ? (
          <Text style={{ color: '#d96868', fontSize: 13, fontFamily: 'Calibre-Medium', marginTop: 4, textAlign: 'center' }}>
            Couldn’t load balances
          </Text>
        ) : (
          <Text style={{ color: head, fontSize: 34, fontFamily: 'Calibre-Semibold', marginTop: 2 }}>
            {totalUsd === null ? '…' : fmtUsd(totalUsd)}
          </Text>
        )}
      </View>

      <View style={{ flexDirection: 'row', gap: 10, marginHorizontal: 16, marginTop: 12 }}>
        <Btn icon="send" label="Send" onPress={() => router.push('/wallet/send')} />
        <Btn icon="arrowDown" label="Receive" onPress={() => router.push('/wallet/receive')} />
      </View>

      {/* Asset list — Snapshot-treasury-style rows, border-bottom separators. */}
      <Text style={{ color: sub, fontSize: 12, fontFamily: 'Calibre-Medium', paddingHorizontal: 16, paddingTop: 22, paddingBottom: 6 }}>
        ASSETS
      </Text>
      <View style={{ marginHorizontal: 16, borderTopWidth: 1, borderTopColor: border }}>
        {(rows ?? ASSETS.map(a => ({
          symbol: a.symbol, name: a.name, balance: '0', priceUsd: null, change24h: null,
          logoUrl: stampTokenUrl(1, a.logoAddress, 48),
        }))).map(r => {
          const valueUsd = r.priceUsd === null ? null : r.priceUsd * Number(r.balance);
          /** Up/down colour for the 24h change pill — green for non-negative,
           *  red for negative. Uses the same tones as Snapshot UI's treasury. */
          const changeColor = r.change24h === null ? sub : r.change24h >= 0 ? '#22c55e' : '#d96868';
          const changeText = r.change24h === null ? '' :
            `${r.change24h >= 0 ? '+' : ''}${r.change24h.toFixed(2)}%`;
          return (
            <View
              key={r.symbol}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 12,
                paddingVertical: 14,
                borderBottomWidth: 1, borderBottomColor: border,
              }}
            >
              {/* Token avatar with a small mainnet network-bullet overlay, like
                  Snapshot UI treasury. `resizeMode: contain` so the IPFS logo
                  isn't cropped/zoomed inside the small badge slot. */}
              <View style={{ width: 48, height: 48 }}>
                <Image
                  source={{ uri: r.logoUrl }}
                  style={{ width: 48, height: 48, borderRadius: 999, backgroundColor: border }}
                />
                <Image
                  source={{ uri: MAINNET_NETWORK_LOGO }}
                  resizeMode="contain"
                  style={{
                    position: 'absolute', right: -2, bottom: -2,
                    width: 14, height: 14, borderRadius: 999,
                    borderWidth: 2, borderColor: bg, backgroundColor: '#ffffff',
                  }}
                />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ color: head, fontSize: 17, fontFamily: 'Calibre-Semibold' }}>{r.symbol}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                  <Text style={{ color: sub, fontSize: 13, fontFamily: 'Calibre-Medium' }}>
                    {r.priceUsd === null ? r.name : fmtUsd(r.priceUsd, r.priceUsd < 1 ? 4 : 2)}
                  </Text>
                  {changeText ? (
                    <Text style={{ color: changeColor, fontSize: 13, fontFamily: 'Calibre-Medium' }}>
                      {changeText}
                    </Text>
                  ) : null}
                </View>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ color: head, fontSize: 17, fontFamily: 'Calibre-Semibold' }}>
                  {rows ? fmtBalance(r.balance) : '…'}
                </Text>
                <Text style={{ color: sub, fontSize: 13, fontFamily: 'Calibre-Medium', marginTop: 2 }}>
                  {valueUsd === null ? '—' : fmtUsd(valueUsd)}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}
