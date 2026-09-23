
import { useCallback, useState } from 'react';
import { xmtpSendTxReference, xmtpSendSignatureReference } from '../../modules/messaging';
import {
  type WalletSendCallsContent, type TransactionReferenceContent, chainIdToNumber,
} from '@stage-labs/client/xmtp/tx';
import { VIEM_CHAINS } from '@stage-labs/client/wallet/assets';
import {
  type SignatureRequestContent, buildSignatureReference, personalMessageForRequest, typedDataForRequest,
} from '@stage-labs/client/xmtp/sign';
import { sendCall } from '../../lib/tx';
import { deriveConfirmSummary, confirmMessage } from '../../lib/txConfirm';
import { deriveSignSummary, signConfirmMessage } from '../../lib/signConfirm';
import { capabilities } from '../../lib/capabilities';
import { txErrorMessage } from '@stage-labs/client/wallet/txError';
import type { TypedDataDefinition } from 'viem';
import { base } from 'viem/chains';
import { getActiveAccount, getActiveViemAccount } from '../../lib/accounts';
import { kernelClientForRecord } from '../../lib/zerodev';
import { paymentBlocker } from './pay.model';

function typedDataOf(req: SignatureRequestContent): TypedDataDefinition {
  return typedDataForRequest(req) as unknown as TypedDataDefinition;
}

interface RequestSigner {
  address: string;
  signTypedData: (typedData: TypedDataDefinition) => Promise<string>;
  signMessage: (args: { message: string }) => Promise<string>;
}

async function requestSigner(): Promise<RequestSigner> {
  const active = await getActiveAccount();
  if (active?.type === 'smart') {
    const kernel = await kernelClientForRecord(active, 'sign');
    return {
      address: active.address,
      signTypedData: (typedData) => kernel.signTypedData(typedData as Parameters<typeof kernel.signTypedData>[0]),
      signMessage: (args) => kernel.signMessage(args as Parameters<typeof kernel.signMessage>[0]),
    };
  }
  const local = await getActiveViemAccount();
  if (!local) throw new Error('No active wallet to sign with');
  return local;
}

async function produceAndPostSignature(activeLine: string, requestId: string, req: SignatureRequestContent): Promise<void> {
  const signer = await requestSigner();
  const signature = req.kind === 'eip712'
    ? await signer.signTypedData(typedDataOf(req))
    : await signer.signMessage({ message: personalMessageForRequest(req) });
  await xmtpSendSignatureReference(activeLine, buildSignatureReference(requestId, signature, signer.address));
}

type TxCall = NonNullable<WalletSendCallsContent['calls']>[number];

async function broadcastCall(to: string, call: TxCall, chainId: number): Promise<{ txHash: `0x${string}`; settledChainId: number }> {
  const active = await getActiveAccount();
  if (active?.type === 'smart') {
    if (chainId !== base.id) throw new Error('Your Stage wallet pays on Base only.');
    const kernel = await kernelClientForRecord(active);
    const txHash = await kernel.sendTransaction({
      to: to as `0x${string}`,
      value: BigInt(call.value ?? '0x0'),
      ...(call.data ? { data: call.data as `0x${string}` } : {}),
    } as Parameters<typeof kernel.sendTransaction>[0]);
    return { txHash, settledChainId: base.id };
  }
  const txHash = await sendCall({ to, data: call.data, value: call.value, chainId });
  return { txHash, settledChainId: chainId };
}

function chainMeta(chainId: number): { chainName: string; nativeSymbol: string } {
  const chain = VIEM_CHAINS[chainId];
  return {
    chainName: chain?.name ?? `chain ${chainId}`,
    nativeSymbol: chain?.nativeCurrency?.symbol ?? 'ETH',
  };
}

function paymentReceipt(
  txHash: `0x${string}`, settledChainId: number,
  summary: ReturnType<typeof deriveConfirmSummary>, nativeSymbol: string,
): TransactionReferenceContent {
  return {
    networkId: settledChainId, reference: txHash,
    metadata: {
      transactionType: 'transfer',
      currency: summary.symbol ?? nativeSymbol,
      ...(summary.amount != null ? { amount: Number(summary.amount) } : {}),
      toAddress: summary.recipient,
    },
  };
}

function useBusyIds(): { ids: Set<string>; run: (id: string, failMsg: string, task: () => Promise<void>) => void } {
  const [ids, setIds] = useState<Set<string>>(new Set());
  const run = useCallback((id: string, failMsg: string, task: () => Promise<void>): void => {
    setIds(prev => new Set(prev).add(id));
    void task()
      .catch((e: unknown) => { capabilities.toast(txErrorMessage(e, failMsg)); })
      .finally(() => { setIds(prev => { const n = new Set(prev); n.delete(id); return n; }); });
  }, []);
  return { ids, run };
}

export function useTxSignLayer(activeLine: string) {
  const signing = useBusyIds();
  const paying = useBusyIds();
  const runSign = signing.run, runPay = paying.run;

  const onSign = useCallback((requestId: string, req: SignatureRequestContent) => {
    const summary = deriveSignSummary(req);
    void capabilities.confirm({
      title: summary.highRisk ? 'High-risk signature' : 'Confirm signature',
      message: signConfirmMessage(summary, req.description),
      confirmLabel: summary.highRisk ? 'Sign anyway' : 'Sign',
      destructive: summary.highRisk,
    }).then((ok) => {
      if (ok) runSign(requestId, 'Signing failed', () => produceAndPostSignature(activeLine, requestId, req));
    });
  }, [activeLine, runSign]);

  const onPay = useCallback((requestId: string, wsc: WalletSendCallsContent) => {
    const call = wsc.calls?.[0];
    if (!call?.to) { capabilities.toast('Malformed payment request'); return; }
    const callTo = call.to;
    const chainId = chainIdToNumber(wsc.chainId);
    const { chainName, nativeSymbol } = chainMeta(chainId);
    const summary = deriveConfirmSummary(
      { to: call.to, data: call.data, value: call.value }, nativeSymbol,
    );
    const broadcast = async (): Promise<void> => {
      const { txHash, settledChainId } = await broadcastCall(callTo, call, chainId);
      await xmtpSendTxReference(activeLine, paymentReceipt(txHash, settledChainId, summary, nativeSymbol));
    };
    void getActiveAccount().then(async (active) => {
      const blocker = paymentBlocker({
        callCount: wsc.calls?.length ?? 0, chainId, chainName, smartAccount: active?.type === 'smart',
      });
      if (blocker !== null) { capabilities.toast(blocker); return; }
      const ok = await capabilities.confirm({
        title: summary.verified ? 'Confirm payment' : 'Unverified transaction',
        message: confirmMessage(summary, chainName),
        confirmLabel: summary.verified ? 'Pay' : 'Continue anyway',
        destructive: !summary.verified,
      });
      if (ok) runPay(requestId, 'Payment failed', broadcast);
    });
  }, [activeLine, runPay]);

  return { signingIds: signing.ids, onSign, payingIds: paying.ids, onPay };
}
