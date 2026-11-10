import { useCallback } from 'react';
import { xmtpSendTxReference, xmtpSendSignatureReference } from '../../lib/xmtp.messages';
import { type WalletSendCallsContent, type TransactionReferenceContent, chainIdToNumber } from '@stage-labs/client/xmtp/tx';
import { VIEM_CHAINS } from '@stage-labs/client/wallet/assets';
import {
  type SignatureRequestContent,
  buildSignatureReference,
  personalMessageForRequest,
  typedDataForRequest,
} from '@stage-labs/client/xmtp/sign';
import { sendCall } from '../../lib/tx';
import { deriveConfirmSummary, confirmMessage, deriveSignSummary, signConfirmMessage } from '@stage-labs/client/wallet/txConfirm';
import { capabilities } from '../../lib/capabilities';
import { txErrorMessage } from '@stage-labs/client/wallet/txError';
import type { TypedDataDefinition } from 'viem';
import { base } from 'viem/chains';
import { getActiveAccount, getActiveViemAccount } from '../../lib/accounts';
import { kernelClientForRecord } from '../../lib/zerodev/client';
import { paymentBlocker } from './pay.model';
import { NO_REQUESTS, requestPhases, type RequestPhases } from './requests.model';
import { useMachine } from '../../lib/useMachine';
import { recover, report } from '../../lib/errorPolicy';

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
    const kernel = await kernelClientForRecord(active);
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
  const signature =
    req.kind === 'eip712'
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
  return { chainName: chain?.name ?? `chain ${chainId}`, nativeSymbol: chain?.nativeCurrency?.symbol ?? 'ETH' };
}

function paymentReceipt(
  txHash: `0x${string}`,
  settledChainId: number,
  summary: ReturnType<typeof deriveConfirmSummary>,
  nativeSymbol: string,
): TransactionReferenceContent {
  return {
    networkId: settledChainId,
    reference: txHash,
    metadata: {
      transactionType: 'transfer',
      currency: summary.symbol ?? nativeSymbol,
      ...(summary.amount != null ? { amount: Number(summary.amount) } : {}),
      toAddress: summary.recipient,
    },
  };
}

const RECEIPT_NOT_POSTED = 'Payment sent, but its receipt could not be posted to this chat.';

function useSignRequests(activeLine: string): { phases: RequestPhases; onSign: (requestId: string, req: SignatureRequestContent) => void } {
  const [phases, dispatch] = useMachine(requestPhases, NO_REQUESTS);
  const onSign = useCallback(
    (id: string, req: SignatureRequestContent) => {
      const summary = deriveSignSummary(req);
      const run = async (): Promise<void> => {
        const ok = await capabilities.confirm({
          title: summary.highRisk ? 'High-risk signature' : 'Confirm signature',
          message: signConfirmMessage(summary, req.description),
          confirmLabel: summary.highRisk ? 'Sign anyway' : 'Sign',
          destructive: summary.highRisk,
        });
        if (!ok || !dispatch({ type: 'send', id })) return;
        try {
          await produceAndPostSignature(activeLine, id, req);
          dispatch({ type: 'done', id });
        } catch (e) {
          capabilities.toast(txErrorMessage(e, 'Signing failed'));
          dispatch({ type: 'fail', id });
        }
      };
      void run().catch(recover('sign.confirm', undefined));
    },
    [activeLine, dispatch],
  );
  return { phases, onSign };
}

function usePayRequests(activeLine: string): { phases: RequestPhases; onPay: (requestId: string, wsc: WalletSendCallsContent) => void } {
  const [phases, dispatch] = useMachine(requestPhases, NO_REQUESTS);
  const onPay = useCallback(
    (id: string, wsc: WalletSendCallsContent) => {
      const call = wsc.calls?.[0];
      if (!call?.to) {
        capabilities.toast('Malformed payment request');
        return;
      }
      const callTo = call.to;
      const chainId = chainIdToNumber(wsc.chainId);
      const { chainName, nativeSymbol } = chainMeta(chainId);
      const summary = deriveConfirmSummary({ to: call.to, data: call.data, value: call.value }, nativeSymbol);
      const confirmed = async (): Promise<boolean> => {
        const active = await getActiveAccount();
        const blocker = paymentBlocker({ callCount: wsc.calls?.length ?? 0, chainId, chainName, smartAccount: active?.type === 'smart' });
        if (blocker !== null) {
          capabilities.toast(blocker);
          return false;
        }
        return capabilities.confirm({
          title: summary.verified ? 'Confirm payment' : 'Unverified transaction',
          message: confirmMessage(summary, chainName),
          confirmLabel: summary.verified ? 'Pay' : 'Continue anyway',
          destructive: !summary.verified,
        });
      };
      const broadcast = async (): Promise<Awaited<ReturnType<typeof broadcastCall>> | null> => {
        try {
          const sent = await broadcastCall(callTo, call, chainId);
          dispatch({ type: 'done', id });
          return sent;
        } catch (e) {
          capabilities.toast(txErrorMessage(e, 'Payment failed'));
          dispatch({ type: 'fail', id });
          return null;
        }
      };
      const run = async (): Promise<void> => {
        if (!(await confirmed()) || !dispatch({ type: 'send', id })) return;
        const sent = await broadcast();
        if (sent === null) return;
        try {
          await xmtpSendTxReference(activeLine, paymentReceipt(sent.txHash, sent.settledChainId, summary, nativeSymbol));
        } catch (err) {
          report('pay.receipt', err);
          capabilities.toast(RECEIPT_NOT_POSTED);
        }
      };
      void run().catch(recover('pay.confirm', undefined));
    },
    [activeLine, dispatch],
  );
  return { phases, onPay };
}

export function useTxSignLayer(activeLine: string) {
  const sign = useSignRequests(activeLine);
  const pay = usePayRequests(activeLine);
  return { signPhases: sign.phases, onSign: sign.onSign, payPhases: pay.phases, onPay: pay.onPay };
}
