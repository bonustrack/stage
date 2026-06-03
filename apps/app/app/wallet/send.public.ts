/** Public-send state + lifecycle hook for the Wallet → Send screen.
 *
 *  Extracted from send.tsx (behavior identical) to keep both files under the
 *  200-line cap once the Shield mode was added. Owns recipient resolution
 *  (address/ENS), the ETH balance + live price bootstrap, the ETH⇄USD amount
 *  conversion, and the wagmi/Reown submit → broadcast → confirm lifecycle. */
import { useEffect, useMemo, useState } from 'react';
import { isAddress, type Hex } from 'viem';
import { getAccount, waitForTransactionReceipt } from 'wagmi/actions';
import { useAppKit } from '@reown/appkit-wagmi-react-native';
import { resolveEnsName } from '../../lib/ens';
import { sendNativeOrToken } from '../../lib/tx';
import { wagmiConfig } from '../../lib/walletconnect';
import { fetchBalanceAndPrice, looksLikeEns } from './send.helpers';

export type SendTxState = 'idle' | 'submitting' | 'pending' | 'confirmed';

export interface PublicSend {
  to: string; setTo: (v: string) => void;
  amount: string; setAmount: (v: string) => void;
  mode: 'eth' | 'usd'; setMode: (fn: (m: 'eth' | 'usd') => 'eth' | 'usd') => void;
  resolved: string | null; resolving: boolean; resolveErr: string | null;
  ethBalance: string | null; ethPriceUsd: number | null;
  secondaryLabel: string; canSubmit: boolean; busy: boolean;
  txState: SendTxState; txHash: Hex | null; txErr: string | null;
  onMax: () => void; onSubmit: () => void;
}

export function usePublicSend(initialTo: string): PublicSend {
  const { open } = useAppKit();
  const [to, setTo] = useState<string>(initialTo);
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState<'eth' | 'usd'>('eth');
  const [resolved, setResolved] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [resolveErr, setResolveErr] = useState<string | null>(null);
  const [ethBalance, setEthBalance] = useState<string | null>(null);
  const [ethPriceUsd, setEthPriceUsd] = useState<number | null>(null);
  const [txState, setTxState] = useState<SendTxState>('idle');
  const [txHash, setTxHash] = useState<Hex | null>(null);
  const [txErr, setTxErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async (): Promise<void> => {
      try {
        const { ethBalance: bal, ethPriceUsd: p } = await fetchBalanceAndPrice();
        if (cancelled) return;
        setEthBalance(bal);
        if (typeof p === 'number') setEthPriceUsd(p);
      } catch { /* leave both null — UI degrades to a basic Send form */ }
    })();
    return () => { cancelled = true; };
  }, []);

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

  const ethAmount = useMemo(() => {
    const n = Number(amount);
    if (!isFinite(n) || n <= 0) return 0;
    if (mode === 'eth') return n;
    if (!ethPriceUsd) return 0;
    return n / ethPriceUsd;
  }, [amount, mode, ethPriceUsd]);

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

  const busy = txState === 'submitting' || txState === 'pending';
  const canSubmit = !!resolved && ethAmount > 0;

  const onMax = (): void => {
    if (!ethBalance) return;
    if (mode === 'eth') setAmount(ethBalance);
    else if (ethPriceUsd) setAmount((Number(ethBalance) * ethPriceUsd).toFixed(2));
  };

  const onSubmit = (): void => {
    if (!resolved || ethAmount <= 0 || busy) return;
    void (async (): Promise<void> => {
      setTxErr(null); setTxHash(null); setTxState('submitting');
      try {
        if (!getAccount(wagmiConfig).address) {
          await open();
          if (!getAccount(wagmiConfig).address) {
            setTxState('idle'); setTxErr('Connect a wallet to send'); return;
          }
        }
        const ethStr = mode === 'eth' ? amount.trim() : String(ethAmount);
        const hash = await sendNativeOrToken({ to: resolved, amount: ethStr, chainId: 1 });
        setTxHash(hash); setTxState('pending');
        await waitForTransactionReceipt(wagmiConfig, { hash, chainId: 1 });
        setTxState('confirmed');
      } catch (e) {
        setTxState('idle'); setTxErr((e as Error).message ?? 'Transaction failed');
      }
    })();
  };

  return {
    to, setTo, amount, setAmount, mode, setMode, resolved, resolving, resolveErr,
    ethBalance, ethPriceUsd, secondaryLabel, canSubmit, busy, txState, txHash, txErr,
    onMax, onSubmit,
  };
}
