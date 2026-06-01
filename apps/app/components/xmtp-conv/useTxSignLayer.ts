/** In-chat signature + payment request handlers for the XMTP conversation screen
 *  — extracted from app/xmtp/[convId].tsx verbatim (phase-2 lint split). */

import { useCallback, useState } from 'react';
import { xmtpSendTxReference, xmtpSendSignatureReference } from '../../lib/xmtp';
import {
  type WalletSendCallsContent, type TransactionReferenceContent, chainIdToNumber,
} from '@metro-labs/client/xmtp/tx';
import {
  type SignatureRequestContent, type SignatureReferenceContent,
} from '@metro-labs/client/xmtp/sign';
import { sendNativeOrToken } from '../../lib/tx';
import { flash } from '../../lib/toast';
import { signTypedData, signMessage, getAccount } from 'wagmi/actions';
import type { TypedDataDefinition } from 'viem';
import { wagmiConfig } from '../../lib/walletconnect';
import { getActiveViemAccount } from '../../lib/accounts';

export function useTxSignLayer(activeLine: string) {
  /** Message ids whose signature is currently being produced — drives the
   *  Sign-button spinner. */
  const [signingIds, setSigningIds] = useState<Set<string>>(new Set());

  /** Sign an in-chat signature request. For `eip712` we route the typed data
   *  through wagmi `signTypedData`; for `personal` through `signMessage`. On
   *  success we post a SignatureReference back into the SAME conversation so the
   *  request card flips to a "Signed ✓" receipt for everyone. */
  const onSign = useCallback((requestId: string, req: SignatureRequestContent) => {
    setSigningIds(prev => new Set(prev).add(requestId));
    void (async () => {
      try {
        /** Bind every signature to the wallet the rest of the app uses — the
         *  active Reown/wagmi account. Passing `account` explicitly stops wagmi
         *  from falling back to the connector's "current" account (which inside a
         *  list-rendered bubble may not be the live one). */
        /** Prefer the in-app key: if the active account is a local EOA
         *  (generated/imported/migrated) we sign with its viem account directly,
         *  no popup. Only when there's no local key (WalletConnect account) do we
         *  delegate to the remote wallet through wagmi. */
        const local = await getActiveViemAccount();
        const account = local?.address ?? getAccount(wagmiConfig).address;
        if (!account) throw new Error('Connect a wallet to sign');
        let signature: string;
        if (req.kind === 'eip712') {
          const td = req.eip712;
          if (!td) throw new Error('Malformed typed-data request');
          /** viem/wagmi inject the EIP712Domain entry themselves from `domain`;
           *  a duplicate in `types` makes them reject the request. Strip it. */
          const types = { ...td.types };
          delete types.EIP712Domain;
          /** The wire payload is arbitrary JSON (any valid eth_signTypedData_v4
           *  shape), so we cast once to viem's generic `TypedDataDefinition`
           *  rather than satisfy its heavily-conditional generics field-by-field.
           *  A real viem type — not `any`. */
          const typedData = {
            domain: td.domain,
            types,
            primaryType: td.primaryType,
            message: td.message,
          } as unknown as TypedDataDefinition;
          signature = local
            ? await local.signTypedData(typedData)
            : await signTypedData(wagmiConfig, { account, ...typedData });
        } else {
          const message = req.message ?? '';
          if (!message) throw new Error('Empty message to sign');
          signature = local
            ? await local.signMessage({ message })
            : await signMessage(wagmiConfig, { account, message });
        }
        const signer = account;
        const ref: SignatureReferenceContent = { requestId, signature, signer };
        await xmtpSendSignatureReference(activeLine, ref);
      } catch (e) {
        flash((e as Error).message || 'Signing failed');
      } finally {
        setSigningIds(prev => { const n = new Set(prev); n.delete(requestId); return n; });
      }
    })();
  }, [activeLine]);

  /** Message ids whose payment is currently broadcasting — drives the Pay
   *  spinner. */
  const [payingIds, setPayingIds] = useState<Set<string>>(new Set());

  /** Pay an in-chat payment request. Broadcasts the first call via the phase-3
   *  sendTx helper (native ETH or ERC-20 transfer decoded from the call), then
   *  posts a TransactionReference back into the SAME conversation so the request
   *  card flips to a receipt for everyone. */
  const onPay = useCallback((requestId: string, wsc: WalletSendCallsContent) => {
    const call = wsc.calls?.[0];
    if (!call?.to) { flash('Malformed payment request'); return; }
    const chainId = chainIdToNumber(wsc.chainId);
    setPayingIds(prev => new Set(prev).add(requestId));
    void (async () => {
      try {
        /** Native transfer: value is hex wei → decimal ETH for the helper.
         *  (ERC-20 `data` paths aren't built by the composer yet; value-only
         *  native sends are the supported request shape.) */
        const wei = BigInt(call.value ?? '0x0');
        const amount = (Number(wei) / 1e18).toString();
        const txHash = await sendNativeOrToken({ to: call.to as string, amount, chainId });
        const ref: TransactionReferenceContent = {
          networkId: chainId,
          reference: txHash,
          metadata: {
            transactionType: 'transfer',
            currency: call.metadata?.currency ?? 'ETH',
            ...(call.metadata?.amount != null ? { amount: call.metadata.amount } : {}),
            decimals: 18,
            toAddress: call.to as string,
          },
        };
        await xmtpSendTxReference(activeLine, ref);
      } catch (e) {
        flash((e as Error).message || 'Payment failed');
      } finally {
        setPayingIds(prev => { const n = new Set(prev); n.delete(requestId); return n; });
      }
    })();
  }, [activeLine]);

  return { signingIds, onSign, payingIds, onPay };
}
