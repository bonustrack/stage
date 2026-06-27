import { ref, computed, watch, onUnmounted, type Ref, type ComputedRef } from 'vue';
import { createWalletClient, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { ASSETS, type Asset } from '@stage-labs/client/wallet/assets';
import { publicClientFor, broviderTransport, chainFor } from '@stage-labs/client/wallet/client';
import {
  buildPublicTransfer, parseSendAmount, classifyRecipientInput, noAddressSetError, publicSendFee,
} from '@stage-labs/client/wallet/send';
import { friendlyTxError } from '@stage-labs/client/wallet/txError';
import { resolveEnsName } from '@stage-labs/client/api/ens';
import { SCW_CHAIN_ID } from '@stage-labs/client/zerodev/config';
import type { AccountRecord } from '@stage-labs/client/accounts/types';
import { getActiveAccount, loadPk, accountEpoch, smartOwnerSigner } from './accounts';
import { getHostAccount, hostSendTransaction } from './hostSigner';
import { runningInIframe } from './embedBridge';

export type SendTxState = 'idle' | 'submitting' | 'pending' | 'confirmed';

const SCW_CHAIN_ONLY = 'Smart accounts can only send on Base. Switch to a Base token to continue.';

export interface FeePreview {
  feeWei: bigint;
  feeEth: string;
  sponsored?: boolean;
}

interface PublicCall { to: Hex; value: bigint; data?: Hex }

export interface UseSend {
  asset: ComputedRef<Asset | undefined>;
  symbol: ComputedRef<string>;
  balance: Ref<string | null>;
  to: Ref<string>;
  amount: Ref<string>;
  resolved: Ref<string | null>;
  resolving: Ref<boolean>;
  resolveErr: Ref<string | null>;
  fee: Ref<FeePreview | null>;
  feeErr: Ref<string | null>;
  amountErr: ComputedRef<string | null>;
  canSubmit: ComputedRef<boolean>;
  busy: ComputedRef<boolean>;
  txState: Ref<SendTxState>;
  txHash: Ref<Hex | null>;
  txErr: Ref<string | null>;
  onMax: () => void;
  submit: () => void;
}

function findAsset(symbol: string, chainId: number): Asset | undefined {
  return ASSETS.find((a) => a.symbol === symbol && a.chainId === chainId);
}

function parseOrNull(value: string, decimals: number): bigint | null {
  try {
    return parseSendAmount(value, decimals);
  } catch {
    return null;
  }
}

async function sendLocal(id: string, call: PublicCall, chainId: number): Promise<Hex> {
  const pk = loadPk(id);
  if (!pk) throw new Error('No in-app wallet to send from');
  const account = privateKeyToAccount(pk);
  const chain = chainFor(chainId);
  const wallet = createWalletClient({ account, chain, transport: broviderTransport(chainId) });
  return wallet.sendTransaction({
    chain, to: call.to, value: call.value, ...(call.data ? { data: call.data } : {}),
  });
}

async function sendSmart(active: AccountRecord, call: PublicCall): Promise<Hex> {
  if (active.hdIndex == null) throw new Error('Smart account is missing its key index.');
  const { makePublicClient, makeKernelClient } = await import('./zerodev');
  const { createEcdsaKernel } = await import('@stage-labs/client/zerodev/account');
  const owner = smartOwnerSigner(active.hdIndex);
  const publicClient = makePublicClient();
  const account = await createEcdsaKernel(publicClient, owner, active.hdIndex);
  const kernel = makeKernelClient(account, publicClient);
  return kernel.sendTransaction({
    to: call.to, value: call.value, ...(call.data ? { data: call.data } : {}),
  } as Parameters<typeof kernel.sendTransaction>[0]);
}

async function submitTransfer(call: PublicCall, chainId: number): Promise<Hex> {
  const active = await getActiveAccount();
  if (active?.type === 'smart') {
    if (chainId !== SCW_CHAIN_ID) throw new Error(SCW_CHAIN_ONLY);
    return sendSmart(active, call);
  }
  if (runningInIframe()) {
    const host = await getHostAccount();
    if (host) {
      return hostSendTransaction({
        chainId, to: call.to, value: `0x${call.value.toString(16)}`,
        ...(call.data ? { data: call.data } : {}),
      });
    }
  }
  if (!active) throw new Error('No active wallet');
  return sendLocal(active.id, call, chainId);
}

async function estimateFee(call: PublicCall, chainId: number, account?: Hex): Promise<FeePreview> {
  const pub = publicClientFor(chainId);
  const [gas, fees] = await Promise.all([
    pub.estimateGas({ account, to: call.to, value: call.value, ...(call.data ? { data: call.data } : {}) }),
    pub.estimateFeesPerGas(),
  ]);
  return publicSendFee({ gas, maxFeePerGas: fees.maxFeePerGas, gasPrice: fees.gasPrice });
}

function useRecipient(to: Ref<string>): {
  resolved: Ref<string | null>; resolving: Ref<boolean>; resolveErr: Ref<string | null>; stop: () => void;
} {
  const resolved = ref<string | null>(null);
  const resolving = ref(false);
  const resolveErr = ref<string | null>(null);
  let timer: ReturnType<typeof setTimeout> | null = null;
  let seq = 0;

  const stop = watch(to, (raw) => {
    const c = classifyRecipientInput(raw);
    resolveErr.value = null;
    if (timer) { clearTimeout(timer); timer = null; }
    if (c.kind === 'empty' || c.kind === 'invalid') { resolved.value = null; resolving.value = false; return; }
    if (c.kind === 'address') { resolved.value = c.resolved; resolving.value = false; return; }
    const q = raw.trim();
    resolving.value = true;
    const mine = ++seq;
    timer = setTimeout(() => {
      void (async (): Promise<void> => {
        try {
          const addr = await resolveEnsName(c.query);
          if (mine !== seq) return;
          if (addr) resolved.value = addr.toLowerCase();
          else { resolved.value = null; resolveErr.value = noAddressSetError(q); }
        } catch (e) {
          if (mine === seq) { resolved.value = null; resolveErr.value = (e as Error).message; }
        } finally {
          if (mine === seq) resolving.value = false;
        }
      })();
    }, 300);
  });

  return { resolved, resolving, resolveErr, stop: () => { if (timer) clearTimeout(timer); stop(); } };
}

export function useSend(symbolRef: Ref<string>, chainIdRef: Ref<number>, balanceRef: Ref<string | null>): UseSend {
  const asset = computed(() => findAsset(symbolRef.value, chainIdRef.value));
  const symbol = computed(() => symbolRef.value);
  const balance = balanceRef;
  const to = ref('');
  const amount = ref('');
  const fee = ref<FeePreview | null>(null);
  const feeErr = ref<string | null>(null);
  const txState = ref<SendTxState>('idle');
  const txHash = ref<Hex | null>(null);
  const txErr = ref<string | null>(null);

  const recipient = useRecipient(to);
  const { resolved, resolving, resolveErr } = recipient;

  const amountValue = computed<bigint | null>(() => {
    const a = asset.value;
    if (!a || !amount.value.trim()) return null;
    return parseOrNull(amount.value, a.decimals);
  });

  const amountErr = computed<string | null>(() => {
    const a = asset.value;
    if (!a || !amount.value.trim()) return null;
    const value = amountValue.value;
    if (value == null) return 'Invalid amount';
    if (balance.value != null) {
      const bal = parseOrNull(balance.value, a.decimals) ?? 0n;
      if (value > bal) return 'Insufficient balance';
    }
    return null;
  });

  const canSubmit = computed(() =>
    !!resolved.value && !!asset.value && amountValue.value != null && !amountErr.value
    && txState.value === 'idle');
  const busy = computed(() => txState.value === 'submitting' || txState.value === 'pending');

  function onMax(): void {
    if (balance.value != null) amount.value = balance.value;
  }

  let feeSeq = 0;
  const stopFee = watch([resolved, amountValue, asset], () => {
    feeErr.value = null;
    const a = asset.value;
    const rcpt = resolved.value;
    if (!a || !rcpt || amountValue.value == null || amountErr.value) { fee.value = null; return; }
    const mine = ++feeSeq;
    void (async (): Promise<void> => {
      try {
        const active = await getActiveAccount();
        if (active?.type === 'smart') {
          if (a.chainId !== SCW_CHAIN_ID) throw new Error(SCW_CHAIN_ONLY);
          if (mine === feeSeq) fee.value = { feeWei: 0n, feeEth: '0', sponsored: true };
          return;
        }
        const call = buildPublicTransfer({ recipient: rcpt, amount: amount.value, asset: a });
        const account = active?.address as Hex | undefined;
        const next = await estimateFee(call, a.chainId, account);
        if (mine === feeSeq) fee.value = next;
      } catch (e) {
        if (mine === feeSeq) { fee.value = null; feeErr.value = friendlyTxError(e, 'Could not estimate network fee'); }
      }
    })();
  });

  function submit(): void {
    if (!canSubmit.value) return;
    const a = asset.value;
    const rcpt = resolved.value;
    if (!a || !rcpt) return;
    void (async (): Promise<void> => {
      txErr.value = null;
      txHash.value = null;
      txState.value = 'submitting';
      try {
        const call = buildPublicTransfer({ recipient: rcpt, amount: amount.value, asset: a });
        const hash = await submitTransfer(call, a.chainId);
        txHash.value = hash;
        txState.value = 'pending';
        await publicClientFor(a.chainId).waitForTransactionReceipt({ hash });
        txState.value = 'confirmed';
      } catch (e) {
        txState.value = 'idle';
        txErr.value = friendlyTxError(e, 'Transaction failed');
      }
    })();
  }

  const stopEpoch = watch(accountEpoch, () => { fee.value = null; feeErr.value = null; });
  onUnmounted(() => { recipient.stop(); stopFee(); stopEpoch(); });

  return {
    asset, symbol, balance, to, amount, resolved, resolving, resolveErr,
    fee, feeErr, amountErr, canSubmit, busy, txState, txHash, txErr, onMax, submit,
  };
}
