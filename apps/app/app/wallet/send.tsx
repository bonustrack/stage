/** Wallet → Send screen.
 *
 *  v2: address-or-ENS recipient (stamp.fyi resolution), amount input that
 *  toggles between **token units** and **USD**, plus a **Max** affordance that
 *  fills the connected wallet's full balance. Pricing comes from CoinGecko
 *  Pro (sx-monorepo's key); balance from Multicall3 via the brovider RPC.
 *  Submission goes through `sendNativeOrToken` (lib/tx.ts) over the connected
 *  Reown/wagmi wallet, surfacing pending then confirmed state + the tx hash. */

import { useEffect, useMemo, useState } from 'react';
import { ScrollView } from 'react-native';
import { Box } from '../../components/layout';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isAddress, type Hex } from 'viem';
import { resolveEnsName } from '../../lib/ens';
import { usePalette, useEffectiveColorScheme } from '../../lib/theme';
import { sendNativeOrToken } from '../../lib/tx';
import { getAccount, waitForTransactionReceipt } from 'wagmi/actions';
import { wagmiConfig } from '../../lib/walletconnect';
import { useAppKit } from '@reown/appkit-wagmi-react-native';
import { fetchBalanceAndPrice, looksLikeEns } from './send.helpers';
import {
  RecipientField, AmountField, SendHeader, SubmitButton, TxStatus,
} from './send.fields';

export default function WalletSend(): React.ReactElement {
  const router = useRouter();
  /** `to` may be pre-populated by callers (e.g. the profile page's Send
   *  button passes `?to=<address>`) — seed the input from it so the user
   *  doesn't have to retype. */
  const params = useLocalSearchParams<{ to?: string }>();
  const { fg, head, sub, bg, border, rowBg: inputBg } = usePalette();
  const dark = useEffectiveColorScheme() === 'dark';
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
        const { ethBalance: bal, ethPriceUsd: p } = await fetchBalanceAndPrice();
        if (cancelled) return;
        setEthBalance(bal);
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
      <SendHeader fg={fg} head={head} border={border} onBack={() => router.back()} />

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 16 }}>
        <RecipientField
          pal={{ fg, head, sub, border, inputBg }}
          to={to}
          setTo={setTo}
          resolving={resolving}
          resolved={resolved}
          resolveErr={resolveErr}
        />

        <AmountField
          pal={{ fg, head, sub, border, inputBg }}
          dark={dark}
          amount={amount}
          setAmount={setAmount}
          mode={mode}
          setMode={setMode}
          ethBalance={ethBalance}
          ethPriceUsd={ethPriceUsd}
          secondaryLabel={secondaryLabel}
          onMax={onMax}
        />

        <SubmitButton dark={dark} busy={busy} canSubmit={canSubmit} txState={txState} onSubmit={onSubmit} />

        <TxStatus sub={sub} txState={txState} txHash={txHash} txErr={txErr} />
      </ScrollView>
    </Box>
  );
}
