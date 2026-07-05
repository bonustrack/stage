
import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { xmtpSendTxReference, xmtpSendSignatureReference } from '../../modules/messaging';
import {
  type WalletSendCallsContent, type TransactionReferenceContent, chainIdToNumber,
} from '@stage-labs/client/xmtp/tx';
import { VIEM_CHAINS } from '../../components/tabs/WalletScreen.assets';
import {
  type SignatureRequestContent, type SignatureReferenceContent,
} from '@stage-labs/client/xmtp/sign';
import { sendCall } from '../../lib/tx';
import { deriveConfirmSummary, confirmMessage } from '../../lib/txConfirm';
import { deriveSignSummary, signConfirmMessage } from '../../lib/signConfirm';
import { flash } from '../../lib/toast';
import { txErrorMessage } from '@stage-labs/client/wallet/txError';
import type { TypedDataDefinition } from 'viem';
import { base } from 'viem/chains';
import { getActiveAccount, getActiveViemAccount, type AccountRecord } from '../../lib/accounts';
import { kernelClientForRecord } from '../../lib/zerodev';

function typedDataOf(req: SignatureRequestContent): TypedDataDefinition {
  const td = req.eip712;
  if (!td) throw new Error('Malformed typed-data request');
  const types = { ...td.types };
  delete types.EIP712Domain;
  return {
    domain: td.domain, types, primaryType: td.primaryType, message: td.message,
  } as unknown as TypedDataDefinition;
}

async function signWithKernel(req: SignatureRequestContent, active: AccountRecord): Promise<{ signature: string; signer: string }> {
  const kernel = await kernelClientForRecord(active);
  if (req.kind === 'eip712') {
    const typedData = typedDataOf(req);
    const signature = await kernel.signTypedData(typedData as Parameters<typeof kernel.signTypedData>[0]);
    return { signature, signer: active.address };
  }
  const message = req.message ?? '';
  if (!message) throw new Error('Empty message to sign');
  const signature = await kernel.signMessage({ message } as Parameters<typeof kernel.signMessage>[0]);
  return { signature, signer: active.address };
}

async function signWithLocalEoa(req: SignatureRequestContent): Promise<{ signature: string; signer: string }> {
  const local = await getActiveViemAccount();
  if (!local) throw new Error('No active wallet to sign with');
  if (req.kind === 'eip712') {
    const signature = await local.signTypedData(typedDataOf(req));
    return { signature, signer: local.address };
  }
  const message = req.message ?? '';
  if (!message) throw new Error('Empty message to sign');
  const signature = await local.signMessage({ message });
  return { signature, signer: local.address };
}

async function produceAndPostSignature(activeLine: string, requestId: string, req: SignatureRequestContent): Promise<void> {
  const active = await getActiveAccount();
  const { signature, signer } = active?.type === 'smart'
    ? await signWithKernel(req, active)
    : await signWithLocalEoa(req);
  const ref: SignatureReferenceContent = { requestId, signature, signer };
  await xmtpSendSignatureReference(activeLine, ref);
}

type TxCall = NonNullable<WalletSendCallsContent['calls']>[number];

async function broadcastCall(to: string, call: TxCall, chainId: number): Promise<{ txHash: `0x${string}`; settledChainId: number }> {
  const active = await getActiveAccount();
  if (active?.type === 'smart') {
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

export function useTxSignLayer(activeLine: string) {
  const [signingIds, setSigningIds] = useState<Set<string>>(new Set());

  const onSign = useCallback((requestId: string, req: SignatureRequestContent) => {
    const summary = deriveSignSummary(req);
    const doSign = (): void => {
      setSigningIds(prev => new Set(prev).add(requestId));
      void (async () => {
        try {
          await produceAndPostSignature(activeLine, requestId, req);
        } catch (e) {
          flash(txErrorMessage(e, 'Signing failed'));
        } finally {
          setSigningIds(prev => { const n = new Set(prev); n.delete(requestId); return n; });
        }
      })();
    };
    Alert.alert(
      summary.highRisk ? 'High-risk signature' : 'Confirm signature',
      signConfirmMessage(summary, req.description),
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: summary.highRisk ? 'Sign anyway' : 'Sign',
          style: summary.highRisk ? 'destructive' : 'default',
          onPress: doSign,
        },
      ],
    );
  }, [activeLine]);

  const [payingIds, setPayingIds] = useState<Set<string>>(new Set());

  const onPay = useCallback((requestId: string, wsc: WalletSendCallsContent) => {
    const call = wsc.calls?.[0];
    if (!call?.to) { flash('Malformed payment request'); return; }
    const callTo = call.to;
    const chainId = chainIdToNumber(wsc.chainId);
    const { chainName, nativeSymbol } = chainMeta(chainId);
    const summary = deriveConfirmSummary(
      { to: call.to, data: call.data, value: call.value }, nativeSymbol,
    );
    const broadcast = (): void => {
      setPayingIds(prev => new Set(prev).add(requestId));
      void (async () => {
        try {
          const { txHash, settledChainId } = await broadcastCall(callTo, call, chainId);
          const ref = paymentReceipt(txHash, settledChainId, summary, nativeSymbol);
          await xmtpSendTxReference(activeLine, ref);
        } catch (e) {
          flash(txErrorMessage(e, 'Payment failed'));
        } finally {
          setPayingIds(prev => { const n = new Set(prev); n.delete(requestId); return n; });
        }
      })();
    };
    Alert.alert(
      summary.verified ? 'Confirm payment' : 'Unverified transaction',
      confirmMessage(summary, chainName),
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: summary.verified ? 'Pay' : 'Continue anyway',
          style: summary.verified ? 'default' : 'destructive',
          onPress: broadcast,
        },
      ],
    );
  }, [activeLine]);

  return { signingIds, onSign, payingIds, onPay };
}
