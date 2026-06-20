/** @file In-chat signature + payment request handlers for the XMTP conversation screen — extracted from app/xmtp/[convId].tsx verbatim (phase-2 lint split). */

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
import { txErrorMessage } from '../../lib/txError';
import type { TypedDataDefinition } from 'viem';
import { base } from 'viem/chains';
import { getActiveAccount, getActiveViemAccount, type AccountRecord } from '../../lib/accounts';
import { kernelClientForRecord } from '../../lib/zerodev';

/** Build the viem typed-data definition from an eip712 request (stripping the duplicate EIP712Domain entry). */
function typedDataOf(req: SignatureRequestContent): TypedDataDefinition {
  const td = req.eip712;
  if (!td) throw new Error('Malformed typed-data request');
  /** viem injects EIP712Domain from `domain`; a duplicate in `types` is rejected. */
  const types = { ...td.types };
  delete types.EIP712Domain;
  return {
    domain: td.domain, types, primaryType: td.primaryType, message: td.message,
  } as unknown as TypedDataDefinition;
}

/** Produce a signature via the ZeroDev Kernel (ERC-1271), returning {signature, signer}. */
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

/** Produce a signature via a legacy local EOA (no popup), returning {signature, signer}. */
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

/** Sign a request with the active account (smart Kernel or legacy EOA) and post the reference. */
async function produceAndPostSignature(activeLine: string, requestId: string, req: SignatureRequestContent): Promise<void> {
  const active = await getActiveAccount();
  const { signature, signer } = active?.type === 'smart'
    ? await signWithKernel(req, active)
    : await signWithLocalEoa(req);
  const ref: SignatureReferenceContent = { requestId, signature, signer };
  await xmtpSendSignatureReference(activeLine, ref);
}

/** A single tx call's fields. */
type TxCall = NonNullable<WalletSendCallsContent['calls']>[number];

/** Broadcast a payment call via the active account (sponsored Kernel userOp or EOA), returning {txHash, settledChainId}. */
async function broadcastCall(to: string, call: TxCall, chainId: number): Promise<{ txHash: `0x${string}`; settledChainId: number }> {
  const active = await getActiveAccount();
  if (active?.type === 'smart') {
    /** Smart account is a Base Kernel (Base-scoped paymaster) → userOps land on Base. */
    const kernel = await kernelClientForRecord(active);
    const txHash = await kernel.sendTransaction({
      to: to as `0x${string}`,
      value: BigInt(call.value ?? '0x0'),
      ...(call.data ? { data: call.data as `0x${string}` } : {}),
    } as Parameters<typeof kernel.sendTransaction>[0]);
    return { txHash, settledChainId: base.id };
  }
  /** Legacy EOA: forward the call verbatim (to/data/value). */
  const txHash = await sendCall({ to, data: call.data, value: call.value, chainId });
  return { txHash, settledChainId: chainId };
}

/** Resolve a chain's display name + native symbol (with sane fallbacks). */
function chainMeta(chainId: number): { chainName: string; nativeSymbol: string } {
  const chain = VIEM_CHAINS[chainId];
  return {
    chainName: chain?.name ?? `chain ${chainId}`,
    nativeSymbol: chain?.nativeCurrency?.symbol ?? 'ETH',
  };
}

/** Build the receipt content from the VERIFIED summary (decoded bytes), not the request hints. */
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

/** Provides transaction-signing state and handlers for the conversation. */
export function useTxSignLayer(activeLine: string) {
  /** Message ids whose signature is currently being produced — drives the Sign-button spinner. */
  const [signingIds, setSigningIds] = useState<Set<string>>(new Set());

  /** SECURITY: sign an UNTRUSTED peer's request only after an explicit confirm (a single tap can authorize a wallet-draining Permit/Permit2/EIP-3009/Seaport allowance); the summary comes from the typed-data STRUCTURE not the peer's description, high-risk types get a destructive button, and posts a SignatureReference receipt back into the same conversation. */
  const onSign = useCallback((requestId: string, req: SignatureRequestContent) => {
    const summary = deriveSignSummary(req);
    /** Do Sign. */
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

  /** Message ids whose payment is currently broadcasting — drives the Pay spinner. */
  const [payingIds, setPayingIds] = useState<Set<string>>(new Set());

  /** Pay an in-chat payment request: broadcast the first call (native ETH or decoded ERC-20 transfer), then post a TransactionReference receipt back into the same conversation. */
  const onPay = useCallback((requestId: string, wsc: WalletSendCallsContent) => {
    const call = wsc.calls?.[0];
    if (!call?.to) { flash('Malformed payment request'); return; }
    const callTo = call.to;
    const chainId = chainIdToNumber(wsc.chainId);
    const { chainName, nativeSymbol } = chainMeta(chainId);
    /** SECURITY: derive the displayed recipient/amount/token from the ACTUAL broadcast bytes (call.to/data/value), NOT the spoofable peer metadata. */
    const summary = deriveConfirmSummary(
      { to: call.to, data: call.data, value: call.value }, nativeSymbol,
    );
    /** This moves real funds, so confirm before broadcast (message from the verified summary). */
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
