import { useEffect, useMemo, useState } from 'react';
import {
  erc20Abi, encodeFunctionData, parseUnits, createPublicClient, type Hex,
} from 'viem';
import { base } from 'viem/chains';
import { getSimplePrices, type CgPrice } from '@stage-labs/client/api/coingecko';
import { sendNativeOrToken } from '../../lib/tx';
import { getActiveAccount } from '../../lib/accounts';
import { kernelClientForRecord } from '../../lib/zerodev';
import { broviderTransport } from '@stage-labs/client/wallet/client';
import { tokenAmountFromInput } from '@stage-labs/client/wallet/sendAmount';
import { ASSETS } from '@stage-labs/client/wallet/assets';
import type { TokenChoice } from './TokenSelector';
import { resolveHandleToAddress } from '../../lib/resolveHandle';
import {
  recipientAddress, recipientFor, settleRecipient, startRecipient, type RecipientState,
} from './recipient.model';

const RESOLVE_DEBOUNCE_MS = 300;

async function fetchEthPrice(): Promise<number | null> {
  const prices = await getSimplePrices(['ethereum']).catch((): Record<string, CgPrice> => ({}));
  const p = prices.ethereum?.usd;
  return typeof p === 'number' ? p : null;
}

type SendTxState = 'idle' | 'submitting' | 'pending' | 'confirmed';

interface SendAsset { address: Hex | null; decimals: number; }
type ActiveAccount = NonNullable<Awaited<ReturnType<typeof getActiveAccount>>>;

async function sendSmart(active: ActiveAccount, asset: SendAsset, resolved: string, tokStr: string, chainId: number): Promise<Hex> {
  if (chainId !== base.id) throw new Error('Your Stage wallet sends on Base only. Pick a token on Base.');
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

interface PublicSend {
  to: string; setTo: (v: string) => void;
  amount: string; setAmount: (v: string) => void;
  mode: 'eth' | 'usd'; setMode: (fn: (m: 'eth' | 'usd') => 'eth' | 'usd') => void;
  recipient: RecipientState; resolved: string | null; tokenAmountText: string;
  ethBalance: string | null; ethPriceUsd: number | null;
  secondaryLabel: string; canSubmit: boolean; busy: boolean;
  txState: SendTxState; txHash: Hex | null; txChainId: number; txErr: string | null;
  onMax: () => void; onSubmit: () => void;
}

export function usePublicSend(initialTo: string, token: TokenChoice, balance: string | null): PublicSend {
  const [to, setTo] = useState<string>(initialTo);
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState<'eth' | 'usd'>('eth');
  const [stored, setStored] = useState<RecipientState>(() => startRecipient(initialTo));
  const recipient = recipientFor(stored, to);
  const resolved = recipientAddress(recipient);
  const [ethPriceUsd, setEthPriceUsd] = useState<number | null>(null);
  const [txState, setTxState] = useState<SendTxState>('idle');
  const [txHash, setTxHash] = useState<Hex | null>(null);
  const [txChainId, setTxChainId] = useState<number>(token.chainId);
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
        const p = await fetchEthPrice();
        if (cancelled) return;
        if (typeof p === 'number') setEthPriceUsd(p);
      } catch { }
    })();
    return () => { cancelled = true; };
  }, []);

  const tokenPriceUsd = token.symbol === 'ETH' ? ethPriceUsd
    : token.symbol === 'USDC' ? 1 : null;

  useEffect(() => {
    const start = startRecipient(to);
    setStored(start);
    if (start.kind !== 'resolving') return;
    let cancelled = false;
    const t = setTimeout(() => {
      void resolveHandleToAddress(start.query.handle).then((address) => {
        if (!cancelled) setStored(settleRecipient(start, address));
      });
    }, RESOLVE_DEBOUNCE_MS);
    return () => { cancelled = true; clearTimeout(t); };
  }, [to]);

  const tokenAmount = useMemo(
    () => tokenAmountFromInput(amount, mode === 'eth' ? 'primary' : 'usd', tokenPriceUsd),
    [amount, mode, tokenPriceUsd],
  );

  const secondaryLabel = useMemo(
    () => secondaryLabelOf(amount, mode, tokenPriceUsd, token.symbol),
    [amount, mode, tokenPriceUsd, token.symbol],
  );

  const tokenAmountText = mode === 'eth' ? amount.trim() : String(tokenAmount);
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
        const tokStr = tokenAmountText;
        const active = await getActiveAccount();
        if (!active) { setTxState('idle'); setTxErr('No active wallet'); return; }

        const isSmart = active.type === 'smart';
        const receiptChainId = isSmart ? base.id : token.chainId;
        const hash = isSmart
          ? await sendSmart(active, asset, resolved, tokStr, token.chainId)
          : await sendLegacy(asset, resolved, tokStr, token.chainId);
        setTxHash(hash); setTxChainId(receiptChainId); setTxState('pending');
        const pub = createPublicClient({ transport: broviderTransport(receiptChainId) });
        await pub.waitForTransactionReceipt({ hash });
        setTxState('confirmed');
      } catch (e) {
        setTxState('idle'); setTxErr((e as Error).message ?? 'Transaction failed');
      }
    })();
  };

  return {
    to, setTo, amount, setAmount, mode, setMode, recipient, resolved, tokenAmountText,
    ethBalance, ethPriceUsd: tokenPriceUsd, secondaryLabel, canSubmit, busy, txState, txHash, txChainId, txErr,
    onMax, onSubmit,
  };
}
