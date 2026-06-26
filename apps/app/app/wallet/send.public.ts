import { useEffect, useMemo, useState } from 'react';
import {
  erc20Abi, encodeFunctionData, parseUnits, createPublicClient, type Hex,
} from 'viem';
import { base } from 'viem/chains';
import { resolveEnsName } from '../../lib/ens';
import { sendNativeOrToken } from '../../lib/tx';
import { getActiveAccount } from '../../lib/accounts';
import { kernelClientForRecord } from '../../lib/zerodev';
import { broviderTransport } from '@stage-labs/client/wallet/client';
import { classifyRecipientInput, noAddressSetError } from '@stage-labs/client/wallet/send';
import { ASSETS } from '../../components/tabs/WalletScreen.assets';
import type { TokenChoice } from './TokenSelector';
import { fetchBalanceAndPrice } from './send.helpers';

export type SendTxState = 'idle' | 'submitting' | 'pending' | 'confirmed';

interface SendAsset { address: Hex | null; decimals: number; }
type ActiveAccount = NonNullable<Awaited<ReturnType<typeof getActiveAccount>>>;

async function sendSmart(active: ActiveAccount, asset: SendAsset, resolved: string, tokStr: string): Promise<Hex> {
  const kernel = await kernelClientForRecord(active);
  const value = parseUnits(tokStr, asset.address ? asset.decimals : 18);
  return asset.address
    ? kernel.sendTransaction({
        to: asset.address,
        data: encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [resolved as Hex, value] }),
      } as Parameters<typeof kernel.sendTransaction>[0])
    : kernel.sendTransaction({ to: resolved as Hex, value } as Parameters<typeof kernel.sendTransaction>[0]);
}

async function sendLegacy(asset: SendAsset, resolved: string, tokStr: string, chainId: number): Promise<Hex> {
  return sendNativeOrToken({
    to: resolved, amount: tokStr, chainId,
    token: asset.address ? { address: asset.address, decimals: asset.decimals } : undefined,
  });
}

function secondaryLabelOf(amount: string, mode: 'eth' | 'usd', tokenPriceUsd: number | null, symbol: string): string {
  if (!amount.trim() || !tokenPriceUsd) return '';
  const n = Number(amount);
  if (!isFinite(n) || n <= 0) return '';
  if (mode === 'eth') {
    const usd = n * tokenPriceUsd;
    return `≈ ${usd.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })}`;
  }
  const tok = n / tokenPriceUsd;
  return `≈ ${tok.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${symbol}`;
}

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

  const asset = useMemo(
    () => ASSETS.find(a => a.symbol === token.symbol && a.chainId === token.chainId),
    [token.symbol, token.chainId],
  );
  const ethBalance = balance;

  useEffect(() => {
    let cancelled = false;
    void (async (): Promise<void> => {
      try {
        const { ethPriceUsd: p } = await fetchBalanceAndPrice();
        if (cancelled) return;
        if (typeof p === 'number') setEthPriceUsd(p);
      } catch { }
    })();
    return () => { cancelled = true; };
  }, []);

  const tokenPriceUsd = token.symbol === 'ETH' ? ethPriceUsd
    : token.symbol === 'USDC' ? 1 : null;

  useEffect(() => {
    const c = classifyRecipientInput(to);
    setResolveErr(null);
    if (c.kind === 'empty' || c.kind === 'invalid') { setResolved(null); setResolving(false); return; }
    if (c.kind === 'address') { setResolved(c.resolved); setResolving(false); return; }
    const q = to.trim();
    setResolving(true);
    let cancelled = false;
    const t = setTimeout(() => {
      void (async (): Promise<void> => {
        try {
          const addr = await resolveEnsName(c.query);
          if (cancelled) return;
          if (addr) setResolved(addr.toLowerCase());
          else { setResolved(null); setResolveErr(noAddressSetError(q)); }
        } catch (e) {
          if (!cancelled) { setResolved(null); setResolveErr((e as Error).message); }
        } finally { if (!cancelled) setResolving(false); }
      })();
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [to]);

  const tokenAmount = useMemo(() => {
    const n = Number(amount);
    if (!isFinite(n) || n <= 0) return 0;
    if (mode === 'eth') return n;
    if (!tokenPriceUsd) return 0;
    return n / tokenPriceUsd;
  }, [amount, mode, tokenPriceUsd]);

  const secondaryLabel = useMemo(
    () => secondaryLabelOf(amount, mode, tokenPriceUsd, token.symbol),
    [amount, mode, tokenPriceUsd, token.symbol],
  );

  const busy = txState === 'submitting' || txState === 'pending';
  const canSubmit = !!resolved && tokenAmount > 0 && !!asset;

  const onMax = (): void => {
    if (!ethBalance) return;
    if (mode === 'eth') setAmount(ethBalance);
    else if (tokenPriceUsd) setAmount((Number(ethBalance) * tokenPriceUsd).toFixed(2));
  };

  const onSubmit = (): void => {
    if (!resolved || tokenAmount <= 0 || busy || !asset) return;
    void (async (): Promise<void> => {
      setTxErr(null); setTxHash(null); setTxState('submitting');
      try {
        const tokStr = mode === 'eth' ? amount.trim() : String(tokenAmount);
        const active = await getActiveAccount();
        if (!active) { setTxState('idle'); setTxErr('No active wallet'); return; }

        const isSmart = active.type === 'smart';
        const receiptChainId = isSmart ? base.id : token.chainId;
        const hash = isSmart
          ? await sendSmart(active, asset, resolved, tokStr)
          : await sendLegacy(asset, resolved, tokStr, token.chainId);
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
