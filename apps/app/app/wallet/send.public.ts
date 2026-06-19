/**
 * @file Public-send state and lifecycle hook for the Wallet send screen, owning
 * ENS resolution, balance/price bootstrap, token-USD conversion, and the
 * submit-broadcast-confirm flow for smart-account and legacy-EOA transfers.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  isAddress, erc20Abi, encodeFunctionData, parseUnits, createPublicClient, type Hex,
} from 'viem';
import { base } from 'viem/chains';
import { resolveEnsName } from '../../lib/ens';
import { sendNativeOrToken } from '../../lib/tx';
import { getActiveAccount } from '../../lib/accounts';
import { kernelClientForRecord } from '../../lib/zerodev';
import { broviderTransport } from '@stage-labs/client/wallet/client';
import { ASSETS } from '../../components/tabs/WalletScreen.assets';
import type { TokenChoice } from './TokenSelector';
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

/**
 * @param token  the currently selected token (symbol + chainId).
 *  @param balance  that token's balance string from the wallet rows, or null.
 */
export function usePublicSend(initialTo: string, token: TokenChoice, balance: string | null): PublicSend {
  const [to, setTo] = useState<string>(initialTo);
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState<'eth' | 'usd'>('eth');
  const [resolved, setResolved] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [resolveErr, setResolveErr] = useState<string | null>(null);
  const [ethPriceUsd, setEthPriceUsd] = useState<number | null>(null);
  const [txState, setTxState] = useState<SendTxState>('idle');
  const [txHash, setTxHash] = useState<Hex | null>(null);
  const [txErr, setTxErr] = useState<string | null>(null);

  /** The registry asset for the current selection — its address (null = native) and decimals drive the actual transfer call. */
  const asset = useMemo(
    () => ASSETS.find(a => a.symbol === token.symbol && a.chainId === token.chainId),
    [token.symbol, token.chainId],
  );
  /** Balance comes from the wallet rows (passed in); price only matters for the USD toggle and is currently bootstrapped for ETH (USDC ≈ $1 implicitly). */
  const ethBalance = balance;

  useEffect(() => {
    let cancelled = false;
    void (async (): Promise<void> => {
      try {
        const { ethPriceUsd: p } = await fetchBalanceAndPrice();
        if (cancelled) return;
        if (typeof p === 'number') setEthPriceUsd(p);
      } catch { /* leave null — USD toggle degrades to amount-only */ }
    })();
    return () => { cancelled = true; };
  }, []);

  /** Per-unit USD price of the SELECTED token: ETH uses the live feed, USD-pegged stables default to 1 so the USD toggle + Max work without a price call. */
  const tokenPriceUsd = token.symbol === 'ETH' ? ethPriceUsd
    : token.symbol === 'USDC' ? 1 : null;

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

  /** Amount in TOKEN units (the field can be entered in USD via the toggle). */
  const tokenAmount = useMemo(() => {
    const n = Number(amount);
    if (!isFinite(n) || n <= 0) return 0;
    if (mode === 'eth') return n;
    if (!tokenPriceUsd) return 0;
    return n / tokenPriceUsd;
  }, [amount, mode, tokenPriceUsd]);

  const secondaryLabel = useMemo(() => {
    if (!amount.trim() || !tokenPriceUsd) return '';
    const n = Number(amount);
    if (!isFinite(n) || n <= 0) return '';
    if (mode === 'eth') {
      const usd = n * tokenPriceUsd;
      return `≈ ${usd.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })}`;
    }
    const tok = n / tokenPriceUsd;
    return `≈ ${tok.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${token.symbol}`;
  }, [amount, mode, tokenPriceUsd, token.symbol]);

  const busy = txState === 'submitting' || txState === 'pending';
  const canSubmit = !!resolved && tokenAmount > 0 && !!asset;

  /** Handle the Max. */
  const onMax = (): void => {
    if (!ethBalance) return;
    if (mode === 'eth') setAmount(ethBalance);
    else if (tokenPriceUsd) setAmount((Number(ethBalance) * tokenPriceUsd).toFixed(2));
  };

  /** Handle the Submit. */
  const onSubmit = (): void => {
    if (!resolved || tokenAmount <= 0 || busy || !asset) return;
    void (async (): Promise<void> => {
      setTxErr(null); setTxHash(null); setTxState('submitting');
      try {
        const tokStr = mode === 'eth' ? amount.trim() : String(tokenAmount);
        const active = await getActiveAccount();
        if (!active) { setTxState('idle'); setTxErr('No active wallet'); return; }

        let hash: Hex;
        let receiptChainId = token.chainId;
        if (active.type === 'smart') {
          /**
           * Smart account: execute as a SPONSORED userOp on Base through the
           *  Kernel client (the paymaster covers gas; the userOp deploys the
           *  Kernel on first send). Settles on Base regardless of the selected
           *  token's nominal chain, matching the chat-pay smart path.
           */
          const kernel = await kernelClientForRecord(active);
          receiptChainId = base.id;
          const value = parseUnits(tokStr, asset.address ? asset.decimals : 18);
          hash = asset.address
            ? await kernel.sendTransaction({
                to: asset.address,
                data: encodeFunctionData({
                  abi: erc20Abi, functionName: 'transfer', args: [resolved as Hex, value],
                }),
              } as Parameters<typeof kernel.sendTransaction>[0])
            : await kernel.sendTransaction({
                to: resolved as Hex, value,
              } as Parameters<typeof kernel.sendTransaction>[0]);
        } else {
          hash = await sendNativeOrToken({
            to: resolved, amount: tokStr, chainId: token.chainId,
            token: asset.address ? { address: asset.address, decimals: asset.decimals } : undefined,
          });
        }
        setTxHash(hash); setTxState('pending');
        const pub = createPublicClient({ transport: broviderTransport(receiptChainId) });
        await pub.waitForTransactionReceipt({ hash });
        setTxState('confirmed');
      } catch (e) {
        setTxState('idle'); setTxErr((e as Error).message ?? 'Transaction failed');
      }
    })();
  };

  return {
    to, setTo, amount, setAmount, mode, setMode, resolved, resolving, resolveErr,
    ethBalance, ethPriceUsd: tokenPriceUsd, secondaryLabel, canSubmit, busy, txState, txHash, txErr,
    onMax, onSubmit,
  };
}
