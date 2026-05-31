/** Wallet → Send screen.
 *
 *  v2: address-or-ENS recipient (stamp.fyi resolution), amount input that
 *  toggles between **token units** and **USD**, plus a **Max** affordance that
 *  fills the connected wallet's full balance. Pricing comes from CoinGecko
 *  Pro (sx-monorepo's key); balance from Multicall3 via the brovider RPC.
 *  Submission goes through `sendNativeOrToken` (lib/tx.ts) over the connected
 *  Reown/wagmi wallet, surfacing pending then confirmed state + the tx hash. */

import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, TextInput } from 'react-native';
import { Box } from '../../components/layout';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createPublicClient, http, formatEther, isAddress, type Hex } from 'viem';
import { mainnet } from 'viem/chains';
import { getOrCreateXmtpClient } from '../../lib/xmtp';
import { resolveEnsName } from '../../lib/ens';
import { getSimplePrices } from '../../lib/coingecko';
import { usePalette } from '../../lib/theme';
import { HeroIcon } from '../../components/HeroIcon';
import { sendNativeOrToken } from '../../lib/tx';
import { getAccount, waitForTransactionReceipt } from 'wagmi/actions';
import { wagmiConfig } from '../../lib/walletconnect';
import { useAppKit } from '@reown/appkit-wagmi-react-native';

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
  /** `to` may be pre-populated by callers (e.g. the profile page's Send
   *  button passes `?to=<address>`) — seed the input from it so the user
   *  doesn't have to retype. */
  const params = useLocalSearchParams<{ to?: string }>();
  const { fg, head, sub, bg, border, rowBg: inputBg } = usePalette();
  const insets = useSafeAreaInsets();
  const { open } = useAppKit();

  const [to, setTo] = useState<string>(typeof params.to === 'string' ? params.to : '');
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
  /** Submission lifecycle: idle → submitting (awaiting wallet signature /
   *  broadcast) → pending (broadcast, awaiting confirmation) → confirmed. */
  const [txState, setTxState] = useState<'idle' | 'submitting' | 'pending' | 'confirmed'>('idle');
  const [txHash, setTxHash] = useState<Hex | null>(null);
  const [txErr, setTxErr] = useState<string | null>(null);

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

  const busy = txState === 'submitting' || txState === 'pending';

  const onSubmit = (): void => {
    if (!resolved || ethAmount <= 0 || busy) return;
    void (async (): Promise<void> => {
      setTxErr(null);
      setTxHash(null);
      setTxState('submitting');
      try {
        /** Ensure a wallet is connected — pop the AppKit modal otherwise. */
        if (!getAccount(wagmiConfig).address) {
          await open();
          if (!getAccount(wagmiConfig).address) {
            setTxState('idle');
            setTxErr('Connect a wallet to send');
            return;
          }
        }
        /** Use the full-precision input string when in ETH mode; otherwise
         *  derive ETH from the USD value via the live price. */
        const ethStr = mode === 'eth' ? amount.trim() : String(ethAmount);
        const hash = await sendNativeOrToken({ to: resolved, amount: ethStr, chainId: 1 });
        setTxHash(hash);
        setTxState('pending');
        await waitForTransactionReceipt(wagmiConfig, { hash, chainId: 1 });
        setTxState('confirmed');
      } catch (e) {
        setTxState('idle');
        setTxErr((e as Error).message ?? 'Transaction failed');
      }
    })();
  };

  return (
    <Box style={{ flex: 1, backgroundColor: bg, paddingTop: insets.top }}>
      <Box style={{
        flexDirection: 'row', alignItems: 'center', gap: 8,
        paddingHorizontal: 12, paddingTop: 8, paddingBottom: 10,
        borderBottomWidth: 1, borderBottomColor: border,
      }}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={{ padding: 4 }}>
          <HeroIcon name="arrowLeft" size={22} color={fg} />
        </Pressable>
        <Text style={{ color: head, fontSize: 18, fontFamily: 'Calibre-Semibold', flex: 1 }}>Send</Text>
      </Box>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 16 }}>
        {/* Recipient */}
        <Box style={{ gap: 6 }}>
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
            <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 }}>
              <ActivityIndicator size="small" color={fg} />
              <Text style={{ color: sub, fontSize: 13, fontFamily: 'Calibre-Medium' }}>Resolving…</Text>
            </Box>
          ) : resolved ? (
            <Text style={{ color: fg, fontSize: 13, fontFamily: 'Calibre-Medium', paddingHorizontal: 4 }}>
              → {resolved}
            </Text>
          ) : resolveErr ? (
            <Text style={{ color: '#d96868', fontSize: 13, fontFamily: 'Calibre-Medium', paddingHorizontal: 4 }}>
              {resolveErr}
            </Text>
          ) : null}
        </Box>

        {/* Amount + USD/ETH toggle + Max */}
        <Box style={{ gap: 6 }}>
          <Box style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ color: sub, fontSize: 12, fontFamily: 'Calibre-Medium', flex: 1 }}>AMOUNT</Text>
            <Pressable onPress={onMax} hitSlop={6} disabled={!ethBalance}>
              <Text style={{ color: ethBalance ? '#c0a06e' : sub, fontSize: 12, fontFamily: 'Calibre-Semibold' }}>
                MAX
              </Text>
            </Pressable>
          </Box>

          <Box style={{
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
          </Box>

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
        </Box>

        <Pressable
          onPress={onSubmit}
          disabled={!canSubmit || busy || txState === 'confirmed'}
          style={({ pressed }) => ({
            marginTop: 8, paddingVertical: 14, borderRadius: 999, alignItems: 'center',
            flexDirection: 'row', justifyContent: 'center', gap: 8,
            backgroundColor: (!canSubmit || busy) ? inputBg : pressed ? '#a08458' : '#c0a06e',
            opacity: (!canSubmit && !busy) ? 0.6 : 1,
          })}
        >
          {busy ? <ActivityIndicator size="small" color={fg} /> : null}
          <Text style={{ color: (!canSubmit || busy) ? sub : '#000', fontSize: 16, fontFamily: 'Calibre-Semibold' }}>
            {txState === 'submitting' ? 'Confirm in wallet…'
              : txState === 'pending' ? 'Sending…'
              : txState === 'confirmed' ? 'Sent ✓'
              : 'Send'}
          </Text>
        </Pressable>

        {/* Tx status: hash link once broadcast, plus errors. */}
        {txHash ? (
          <Box style={{ gap: 4, paddingHorizontal: 4 }}>
            <Text style={{ color: sub, fontSize: 12, fontFamily: 'Calibre-Medium' }}>
              {txState === 'confirmed' ? 'Confirmed' : 'Pending'}
            </Text>
            <Pressable onPress={() => Linking.openURL(`https://etherscan.io/tx/${txHash}`)} hitSlop={6}>
              <Text style={{ color: '#c0a06e', fontSize: 13, fontFamily: 'Calibre-Medium' }}>
                {txHash.slice(0, 10)}…{txHash.slice(-8)}
              </Text>
            </Pressable>
          </Box>
        ) : null}
        {txErr ? (
          <Text style={{ color: '#d96868', fontSize: 13, fontFamily: 'Calibre-Medium', paddingHorizontal: 4 }}>
            {txErr}
          </Text>
        ) : null}
      </ScrollView>
    </Box>
  );
}
