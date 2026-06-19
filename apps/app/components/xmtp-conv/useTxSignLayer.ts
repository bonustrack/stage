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
import { getActiveAccount, getActiveViemAccount } from '../../lib/accounts';
import { kernelClientForRecord } from '../../lib/zerodev';

/** Provides transaction-signing state and handlers for the conversation. */
// eslint-disable-next-line max-lines-per-function -- TODO(chaitu): refactor to satisfy function-size limits
export function useTxSignLayer(activeLine: string) {
  /** Message ids whose signature is currently being produced — drives the Sign-button spinner. */
  const [signingIds, setSigningIds] = useState<Set<string>>(new Set());

  /**
   * Sign an in-chat signature request. For `eip712` we route the typed data
   *  through wagmi `signTypedData`; for `personal` through `signMessage`. On
   *  success we post a SignatureReference back into the SAME conversation so the
   *  request card flips to a "Signed ✓" receipt for everyone.
   *
   *  SECURITY: a signature is produced from an UNTRUSTED peer's request and a
   *  single tap can authorize a Permit/Permit2/EIP-3009/Seaport allowance that
   *  drains the wallet LATER. So, exactly like onPay, we ALWAYS confirm before
   *  signing. The confirm summary is derived from the typed-data STRUCTURE
   *  (deriveSignSummary), never from the peer's free-text `description`, and a
   *  recognised high-risk primaryType gets an explicit warning + destructive
   *  button. The actual signing only runs from the confirm sheet's onPress.
   */
  const onSign = useCallback((requestId: string, req: SignatureRequestContent) => {
    const summary = deriveSignSummary(req);
    /** Do Sign. */
    const doSign = (): void => {
    setSigningIds(prev => new Set(prev).add(requestId));
    // eslint-disable-next-line complexity -- TODO(chaitu): refactor (complexity 13)
    void (async () => {
      try {
        /**
         * Resolve the ACTIVE account and route signing by its kind. The in-app
         *  wallet is the source of truth — there is no "connect a wallet" step:
         *   - `smart` (ZeroDev Kernel): sign with the Kernel via
         *     kernelClientForRecord. signMessage/signTypedData produce an
         *     ERC-1271 signature (6492-wrapped while counterfactual), gated by the
         *     owner unlock (passkey) at sign-time. The signer is the smart-account
         *     address itself.
         *   - legacy local EOA (`generated`/`privateKey`): sign with its viem
         *     account directly, no popup (backward-compat for old records).
         */
        const active = await getActiveAccount();
        let signature: string;
        let signer: string;
        if (active?.type === 'smart') {
          const kernel = await kernelClientForRecord(active);
          signer = active.address;
          if (req.kind === 'eip712') {
            const td = req.eip712;
            if (!td) throw new Error('Malformed typed-data request');
            const types = { ...td.types };
            delete types.EIP712Domain;
            const typedData = {
              domain: td.domain,
              types,
              primaryType: td.primaryType,
              message: td.message,
            } as unknown as TypedDataDefinition;
            signature = await kernel.signTypedData(
              typedData as Parameters<typeof kernel.signTypedData>[0],
            );
          } else {
            const message = req.message ?? '';
            if (!message) throw new Error('Empty message to sign');
            signature = await kernel.signMessage(
              { message } as Parameters<typeof kernel.signMessage>[0],
            );
          }
          const ref: SignatureReferenceContent = { requestId, signature, signer };
          await xmtpSendSignatureReference(activeLine, ref);
          return;
        }
        /** Legacy local-EOA record (generated/imported/migrated): sign with its viem account directly, no popup. */
        const local = await getActiveViemAccount();
        if (!local) throw new Error('No active wallet to sign with');
        const account = local.address;
        if (req.kind === 'eip712') {
          const td = req.eip712;
          if (!td) throw new Error('Malformed typed-data request');
          /** viem injects the EIP712Domain entry itself from `domain`; a duplicate in `types` makes it reject the request. Strip it. */
          const types = { ...td.types };
          delete types.EIP712Domain;
          /** The wire payload is arbitrary JSON (any valid eth_signTypedData_v4 shape), so we cast once to viem's generic `TypedDataDefinition` rather than satisfy its heavily-conditional generics field-by-field. A real viem type — not `any`. */
          const typedData = {
            domain: td.domain,
            types,
            primaryType: td.primaryType,
            message: td.message,
          } as unknown as TypedDataDefinition;
          signature = await local.signTypedData(typedData);
        } else {
          const message = req.message ?? '';
          if (!message) throw new Error('Empty message to sign');
          signature = await local.signMessage({ message });
        }
        signer = account;
        const ref: SignatureReferenceContent = { requestId, signature, signer };
        await xmtpSendSignatureReference(activeLine, ref);
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

  /**
   * Pay an in-chat payment request. Broadcasts the first call via the phase-3
   *  sendTx helper (native ETH or ERC-20 transfer decoded from the call), then
   *  posts a TransactionReference back into the SAME conversation so the request
   *  card flips to a receipt for everyone.
   */
  // eslint-disable-next-line complexity -- TODO(chaitu): refactor (complexity 12)
  const onPay = useCallback((requestId: string, wsc: WalletSendCallsContent) => {
    const call = wsc.calls?.[0];
    if (!call?.to) { flash('Malformed payment request'); return; }
    const callTo = call.to;
    const chainId = chainIdToNumber(wsc.chainId);
    const chainName = VIEM_CHAINS[chainId]?.name ?? `chain ${chainId}`;
    const nativeSymbol = VIEM_CHAINS[chainId]?.nativeCurrency?.symbol ?? 'ETH';
    /**
     * SECURITY: derive the displayed recipient/amount/token from the ACTUAL
     *  bytes that will be broadcast (`call.to` / `call.data` / `call.value`),
     *  NOT from the peer-supplied `metadata` (which is unbound to the calldata
     *  and trivially spoofable). For an ERC-20 this decodes
     *  `transfer(address,uint256)` from `call.data`; for a native send it reads
     *  `call.to` + `call.value`. An undecodable / unrecognised call yields an
     *  unverified summary so the confirm sheet warns instead of lying.
     */
    const summary = deriveConfirmSummary(
      { to: call.to, data: call.data, value: call.value },
      nativeSymbol,
    );
    /** This moves real funds, so confirm before broadcast; the message is built from the verified summary, never the spoofable metadata hints. */
    const broadcast = (): void => {
    setPayingIds(prev => new Set(prev).add(requestId));
    void (async () => {
      try {
        /**
         * Resolve the ACTIVE account and route execution by its kind — the
         *  in-app wallet is the source of truth, there is no "connect a wallet"
         *  step:
         *   - `smart` (ZeroDev Kernel): execute the call as a SPONSORED userOp
         *     through kernelClientForRecord. The ZeroDev paymaster (Base) covers
         *     gas, so the account needs no native ETH; if the Kernel is still
         *     counterfactual the first userOp deploys it in the same bundle.
         *     Signed by the owner (passkey/unlock) at send-time. Returns the
         *     settled tx hash.
         *   - legacy local EOA: fall through to sendCall, which forwards the call
         *     verbatim from the in-app key (backward-compat for old records).
         */
        const active = await getActiveAccount();
        let txHash: `0x${string}`;
        /**
         * The chain the tx actually settles on — the smart account is a Base
         *  Kernel (paymaster is Base-scoped), so its userOps always land on Base
         *  regardless of the request's declared chainId; EOA/WC honour the
         *  request chain. Used for the receipt's networkId + explorer link.
         */
        let settledChainId = chainId;
        if (active?.type === 'smart') {
          settledChainId = base.id;
          const kernel = await kernelClientForRecord(active);
          txHash = await kernel.sendTransaction({
            to: call.to as `0x${string}`,
            value: BigInt(call.value ?? '0x0'),
            ...(call.data ? { data: call.data as `0x${string}` } : {}),
          } as Parameters<typeof kernel.sendTransaction>[0]);
        } else {
          /** Forward the request's call VERBATIM (`to`/`data`/`value`): for an ERC-20 this broadcasts the encoded `transfer(...)` to the token contract; for a native send it's a value-only tx. */
          txHash = await sendCall({
            to: callTo, data: call.data, value: call.value, chainId,
          });
        }
        /** Receipt metadata is built from the VERIFIED summary (decoded from the broadcast bytes), so the on-chain truth, not the request's hints, is what the receipt card shows. */
        const ref: TransactionReferenceContent = {
          networkId: settledChainId,
          reference: txHash,
          metadata: {
            transactionType: 'transfer',
            currency: summary.symbol ?? nativeSymbol,
            ...(summary.amount != null ? { amount: Number(summary.amount) } : {}),
            toAddress: summary.recipient,
          },
        };
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
