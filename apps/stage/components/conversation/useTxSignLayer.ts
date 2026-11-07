import { useCallback, useState } from 'react';
import { isAddress } from 'viem';
import { xmtpSendTxReference, xmtpSendSignatureReference } from '../../lib/xmtp.messages';
import { type WalletSendCallsContent, type TransactionReferenceContent, chainIdToNumber } from '@stage-labs/client/xmtp/tx';
import { viemChainName, VIEM_CHAINS } from '@stage-labs/client/wallet/chains';
import {
  type SignatureRequestContent,
  buildSignatureReference,
  personalMessageForRequest,
  typedDataForRequest,
} from '@stage-labs/client/xmtp/sign';
import { sendCallsFrom, signFrom, type SignRequest, type TxCall } from '../../lib/tx';
import { deriveConfirmSummary, confirmMessage, deriveSignSummary, signConfirmMessage } from '@stage-labs/client/wallet/txConfirm';
import { capabilities } from '../../lib/capabilities';
import { txErrorMessage } from '@stage-labs/client/wallet/txError';
import { getActiveAccount } from '../../lib/accounts';
import { paymentBlocker } from './pay.model';
import { reported } from '../../lib/errorPolicy';

const NO_SEND_KEY = 'No in-app wallet to send from';
const NO_SIGN_KEY = 'No active wallet to sign with';

function signRequestOf(req: SignatureRequestContent): SignRequest {
  return req.kind === 'eip712' ? { typedData: typedDataForRequest(req) } : { message: personalMessageForRequest(req) };
}

async function produceAndPostSignature(activeLine: string, requestId: string, req: SignatureRequestContent): Promise<void> {
  const { signature, address } = await signFrom(await getActiveAccount(), signRequestOf(req), { missingKey: NO_SIGN_KEY });
  await xmtpSendSignatureReference(activeLine, buildSignatureReference(requestId, signature, address));
}

type RequestCall = NonNullable<WalletSendCallsContent['calls']>[number];

function txCallOf(to: string, call: RequestCall): TxCall {
  if (!isAddress(to)) throw new Error('Invalid recipient address');
  return { to, value: BigInt(call.value ?? '0x0'), ...(call.data ? { data: call.data as `0x${string}` } : {}) };
}

async function broadcastCall(to: string, call: RequestCall, chainId: number): Promise<{ txHash: `0x${string}`; settledChainId: number }> {
  const sent = await sendCallsFrom(await getActiveAccount(), [txCallOf(to, call)], { chainId, missingKey: NO_SEND_KEY });
  return { txHash: sent.hash, settledChainId: sent.chainId };
}

function chainMeta(chainId: number): { chainName: string; nativeSymbol: string } {
  return { chainName: viemChainName(chainId) ?? `chain ${chainId}`, nativeSymbol: VIEM_CHAINS[chainId]?.nativeCurrency?.symbol ?? 'ETH' };
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

function useBusyIds(): { ids: Set<string>; run: (id: string, failMsg: string, task: () => Promise<void>) => void } {
  const [ids, setIds] = useState<Set<string>>(new Set());
  const run = useCallback((id: string, failMsg: string, task: () => Promise<void>): void => {
    setIds((prev) => new Set(prev).add(id));
    void task()
      .catch((e: unknown) => {
        capabilities.toast(txErrorMessage(e, failMsg));
      })
      .finally(() => {
        setIds((prev) => {
          const n = new Set(prev);
          n.delete(id);
          return n;
        });
      });
  }, []);
  return { ids, run };
}

export function useTxSignLayer(activeLine: string) {
  const signing = useBusyIds();
  const paying = useBusyIds();
  const runSign = signing.run,
    runPay = paying.run;

  const onSign = useCallback(
    (requestId: string, req: SignatureRequestContent) => {
      const summary = deriveSignSummary(req);
      void capabilities
        .confirm({
          title: summary.highRisk ? 'High-risk signature' : 'Confirm signature',
          message: signConfirmMessage(summary, req.description),
          confirmLabel: summary.highRisk ? 'Sign anyway' : 'Sign',
          destructive: summary.highRisk,
        })
        .then((ok) => {
          if (ok) runSign(requestId, 'Signing failed', () => produceAndPostSignature(activeLine, requestId, req));
        });
    },
    [activeLine, runSign],
  );

  const onPay = useCallback(
    (requestId: string, wsc: WalletSendCallsContent) => {
      const call = wsc.calls?.[0];
      if (!call?.to) {
        capabilities.toast('Malformed payment request');
        return;
      }
      const callTo = call.to;
      const chainId = chainIdToNumber(wsc.chainId);
      const { chainName, nativeSymbol } = chainMeta(chainId);
      const summary = deriveConfirmSummary({ to: call.to, data: call.data, value: call.value }, nativeSymbol);
      const broadcast = async (): Promise<void> => {
        const { txHash, settledChainId } = await broadcastCall(callTo, call, chainId);
        await xmtpSendTxReference(activeLine, paymentReceipt(txHash, settledChainId, summary, nativeSymbol));
      };
      void getActiveAccount().then(async (active) => {
        const blocker = paymentBlocker({ callCount: wsc.calls?.length ?? 0, chainId, chainName, smartAccount: active?.type === 'smart' });
        if (blocker !== null) {
          capabilities.toast(blocker);
          return;
        }
        const ok = await capabilities.confirm({
          title: summary.verified ? 'Confirm payment' : 'Unverified transaction',
          message: confirmMessage(summary, chainName),
          confirmLabel: summary.verified ? 'Pay' : 'Continue anyway',
          destructive: !summary.verified,
        });
        if (ok) runPay(requestId, 'Payment failed', broadcast);
      }, reported('chat.pay'));
    },
    [activeLine, runPay],
  );

  return { signingIds: signing.ids, onSign, payingIds: paying.ids, onPay };
}
