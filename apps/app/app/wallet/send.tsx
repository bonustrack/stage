/** Wallet → Send screen.
 *
 *  v2: address-or-ENS recipient (stamp.fyi resolution), amount input that
 *  toggles between **token units** and **USD**, plus a **Max** affordance that
 *  fills the connected wallet's full balance. Pricing comes from CoinGecko
 *  Pro (sx-monorepo's key); balance from Multicall3 via the brovider RPC.
 *  Actual transaction submission still goes through an `Alert` placeholder
 *  until the WalletConnect signer pipeline lands — the math + UX are the
 *  contract we're shipping. */

import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createPublicClient, http, formatEther, isAddress, type Hex } from 'viem';
import { mainnet } from 'viem/chains';
import { getOrCreateXmtpClient } from '../../lib/xmtp';
import { resolveEnsName } from '../../lib/ens';
import { getSimplePrices } from '../../lib/coingecko';
import { useEffectiveColorScheme } from '../../lib/theme';
import { HeroIcon } from '../../components/HeroIcon';

const MULTICALL3 = '0xcA11bde05977b3631167028862bE2a173976CA11' as const;
const multicall3Abi = [{
  name: 'getEthBalance', type: 'function', stateMutability: 'view',
  inputs: [{ name: 'a', type: 'address' }],
  outputs: [{ name: 'b', type: 'uint256' }],
}] as const;

function looksLikeEns(s: string): boolean {
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+\.eth$|^[a-z0-9-]+\.eth$/i.test(s.trim());
}

export default function WalletSend(): React.ReactElement {
  const router = useRouter();
  const dark = useEffectiveColorScheme() === 'dark';
  const head = dark ? '#ffffff' : '#000000';
  const fg = dark ? '#9f9fa3' : '#57606a';
  const sub = dark ? '#7a7a7e' : '#8a929d';
  const bg = dark ? '#0e0f10' : '#ffffff';
  const border = dark ? '#282a2d' : '#e4e4e5';
  const inputBg = dark ? '#282a2d' : '#e4e4e5';
  const insets = useSafeAreaInsets();

  const [to, setTo] = useState('');
  /** The text in the amount input — keyed by `mode`. */
  const [amount, setAmount] = useState('');
  /** `eth` = the input value is interpreted as ETH units; `usd` = as USD.
   *  The OTHER value is computed on the fly via the live price. */
  const [mode, setMode] = useState<'eth' | 'usd'>('eth');
  const [resolved, setResolved] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [resolveErr, setResolveErr] = useState<string | null>(null);
  const [ethBalance, setEthBalance] = useState<string | null>(null);
  const [ethPriceUsd, setEthPriceUsd] = useState<number | null>(null);

  /** Bootstrap: pull the connected wallet's ETH balance + the live ETH price
   *  so `Max` and the USD↔ETH conversion have real numbers to work with. */
  useEffect(() => {
    let cancelled = false;
    void (async (): Promise<void> => {
      try {
        const client = await getOrCreateXmtpClient('production');
        const addr = client.publicIdentity.identifier as Hex;
        const pub = createPublicClient({ chain: mainnet, transport: http('https://rpc.brovider.xyz/1') });
        const [bal, prices] = await Promise.all([
          pub.readContract({ address: MULTICALL3, abi: multicall3Abi, functionName: 'getEthBalance', args: [addr] }),
          getSimplePrices(['ethereum']).catch(() => ({} as Record<string, { usd: number }>)),
        ]);
        if (cancelled) return;
        setEthBalance(formatEther(bal as bigint));
        const p = prices['ethereum']?.usd;
        if (typeof p === 'number') setEthPriceUsd(p);
      } catch { /* leave both as null — UI degrades to a basic Send form */ }
    })();
    return () => { cancelled = true; };
  }, []);

  /** Debounced recipient resolution — same flow as /search. */
  useEffect(() => {
    const q = to.trim();
    setResolveErr(null);
    if (!q) { setResolved(null); setResolving(false); return; }
    if (isAddress(q)) { setResolved(q.toLowerCase()); setResolving(false); return; }
    if (!looksLikeEns(q)) { setResolved(null); setResolving(false); return; }
    setResolving(true);
    let cancelled = false;
    const t = setTimeout(() => {
      void (async (): Promise<void> => {
        try {
          const addr = await resolveEnsName(q.toLowerCase());
          if (cancelled) return;
          if (addr) setResolved(addr.toLowerCase());
          else { setResolved(null); setResolveErr(`No address set for ${q}`); }
        } catch (e) {
          if (!cancelled) { setResolved(null); setResolveErr((e as Error).message); }
        } finally { if (!cancelled) setResolving(false); }
      })();
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [to]);

  /** Authoritative "ETH being sent" — derived from the input + mode. */
  const ethAmount = useMemo(() => {
    const n = Number(amount);
    if (!isFinite(n) || n <= 0) return 0;
    if (mode === 'eth') return n;
    /** USD mode: divide by price. Skip when the price hasn't loaded yet. */
    if (!ethPriceUsd) return 0;
    return n / ethPriceUsd;
  }, [amount, mode, ethPriceUsd]);
  /** Secondary line beneath the amount input — opposite unit of `mode`. */
  const secondaryLabel = useMemo(() => {
    if (!amount.trim() || !ethPriceUsd) return '';
    const n = Number(amount);
    if (!isFinite(n) || n <= 0) return '';
    if (mode === 'eth') {
      const usd = n * ethPriceUsd;
      return `≈ ${usd.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })}`;
    }
    const eth = n / ethPriceUsd;
    return `≈ ${eth.toLocaleString(undefined, { maximumFractionDigits: 6 })} ETH`;
  }, [amount, mode, ethPriceUsd]);

  const canSubmit = !!resolved && ethAmount > 0;

  const onMax = (): void => {
    if (!ethBalance) return;
    /** Always fill the input with the value in the active mode. ETH mode →
     *  raw balance; USD mode → balance × price. */
    if (mode === 'eth') setAmount(ethBalance);
    else if (ethPriceUsd) setAmount((Number(ethBalance) * ethPriceUsd).toFixed(2));
  };

  const onSubmit = (): void => {
    Alert.alert(
      'Send',
      `Send is wired into the form but the signer is not connected yet.\n\nTo: ${resolved}\nAmount: ${ethAmount.toLocaleString(undefined, { maximumFractionDigits: 6 })} ETH`,
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: bg, paddingTop: insets.top }}>
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: 8,
        paddingHorizontal: 12, paddingTop: 8, paddingBottom: 10,
        borderBottomWidth: 1, borderBottomColor: border,
      }}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={{ padding: 4 }}>
          <HeroIcon name="arrowLeft" size={22} color={fg} />
        </Pressable>
        <Text style={{ color: head, fontSize: 18, fontFamily: 'Calibre-Semibold', flex: 1 }}>Send</Text>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 16 }}>
        {/* Recipient */}
        <View style={{ gap: 6 }}>
          <Text style={{ color: sub, fontSize: 12, fontFamily: 'Calibre-Medium' }}>RECIPIENT</Text>
          <TextInput
            value={to}
            onChangeText={setTo}
            placeholder="0x… or name.eth"
            placeholderTextColor={sub}
            autoCapitalize="none"
            autoCorrect={false}
            style={{
              color: head, fontSize: 16, fontFamily: 'Calibre-Medium',
              backgroundColor: inputBg, borderRadius: 12,
              paddingHorizontal: 14, paddingVertical: 12,
            }}
          />
          {resolving ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 }}>
              <ActivityIndicator size="small" color={fg} />
              <Text style={{ color: sub, fontSize: 13, fontFamily: 'Calibre-Medium' }}>Resolving…</Text>
            </View>
          ) : resolved ? (
            <Text style={{ color: fg, fontSize: 13, fontFamily: 'Calibre-Medium', paddingHorizontal: 4 }}>
              → {resolved}
            </Text>
          ) : resolveErr ? (
            <Text style={{ color: '#d96868', fontSize: 13, fontFamily: 'Calibre-Medium', paddingHorizontal: 4 }}>
              {resolveErr}
            </Text>
          ) : null}
        </View>

        {/* Amount + USD/ETH toggle + Max */}
        <View style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ color: sub, fontSize: 12, fontFamily: 'Calibre-Medium', flex: 1 }}>AMOUNT</Text>
            <Pressable onPress={onMax} hitSlop={6} disabled={!ethBalance}>
              <Text style={{ color: ethBalance ? '#c0a06e' : sub, fontSize: 12, fontFamily: 'Calibre-Semibold' }}>
                MAX
              </Text>
            </Pressable>
          </View>

          <View style={{
            flexDirection: 'row', alignItems: 'center',
            backgroundColor: inputBg, borderRadius: 12,
            paddingHorizontal: 14, paddingVertical: 12, gap: 8,
          }}>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              placeholder="0.0"
              placeholderTextColor={sub}
              keyboardType="decimal-pad"
              style={{
                flex: 1, color: head, fontSize: 18, fontFamily: 'Calibre-Semibold',
                padding: 0,
              }}
            />
            {/* Mode toggle — pressing it flips ETH↔USD and converts the
                current value so the user doesn't lose what they typed. */}
            <Pressable
              onPress={() => {
                if (!amount.trim() || !ethPriceUsd) { setMode(m => m === 'eth' ? 'usd' : 'eth'); return; }
                const n = Number(amount);
                if (!isFinite(n) || n <= 0) { setMode(m => m === 'eth' ? 'usd' : 'eth'); return; }
                if (mode === 'eth') {
                  /** ETH → USD: round to cents for UX. */
                  setAmount((n * ethPriceUsd).toFixed(2));
                  setMode('usd');
                } else {
                  setAmount((n / ethPriceUsd).toFixed(6).replace(/0+$/, '').replace(/\.$/, ''));
                  setMode('eth');
                }
              }}
              style={({ pressed }) => ({
                flexDirection: 'row', alignItems: 'center', gap: 4,
                paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999,
                backgroundColor: pressed ? border : 'transparent',
              })}
            >
              <Text style={{ color: head, fontSize: 15, fontFamily: 'Calibre-Semibold' }}>
                {mode === 'eth' ? 'ETH' : 'USD'}
              </Text>
              <HeroIcon name="arrowDown" size={14} color={fg} />
            </Pressable>
          </View>

          {secondaryLabel ? (
            <Text style={{ color: sub, fontSize: 12, fontFamily: 'Calibre-Medium', paddingHorizontal: 4 }}>
              {secondaryLabel}
            </Text>
          ) : null}
          {ethBalance ? (
            <Text style={{ color: sub, fontSize: 12, fontFamily: 'Calibre-Medium', paddingHorizontal: 4 }}>
              Balance: {Number(ethBalance).toLocaleString(undefined, { maximumFractionDigits: 6 })} ETH
            </Text>
          ) : null}
        </View>

        <Pressable
          onPress={onSubmit}
          disabled={!canSubmit}
          style={({ pressed }) => ({
            marginTop: 8, paddingVertical: 14, borderRadius: 999, alignItems: 'center',
            backgroundColor: !canSubmit ? inputBg : pressed ? '#a08458' : '#c0a06e',
            opacity: !canSubmit ? 0.6 : 1,
          })}
        >
          <Text style={{ color: !canSubmit ? sub : '#000', fontSize: 16, fontFamily: 'Calibre-Semibold' }}>
            Send
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
