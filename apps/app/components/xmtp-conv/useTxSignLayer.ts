/** In-chat signature + payment request handlers for the XMTP conversation screen
 *  — extracted from app/xmtp/[convId].tsx verbatim (phase-2 lint split). */

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
    /** ERC-20 requests carry `data` (encoded `transfer(...)`) with `to` = the
     *  token contract and the real recipient in `metadata.toAddress`; native
     *  requests carry only `value` (hex wei) with `to` = the recipient. Detect
     *  ERC-20 by the presence of `data` so we forward the call verbatim instead
     *  of rebuilding it as a native send. */
    const wei = BigInt(call.value ?? '0x0');
    /** Human display amount + recipient — prefer the metadata hints (the only
     *  amount source for ERC-20, since `value` is 0), else decode native wei. */
    const amount = call.metadata?.amount != null
      ? String(call.metadata.amount)
      : (Number(wei) / 1e18).toString();
    const recipient = (call.metadata?.toAddress as string | undefined) ?? (call.to as string);
    const currency = call.metadata?.currency ?? 'ETH';
    const chainName = VIEM_CHAINS[chainId]?.name ?? `chain ${chainId}`;
    /** Minimal confirm before broadcast — this moves real funds (mainnet) so
     *  show amount / recipient / network and require an explicit tap. */
    const broadcast = (): void => {
    setPayingIds(prev => new Set(prev).add(requestId));
    void (async () => {
      try {
        /** Forward the request's call VERBATIM (`to`/`data`/`value`): for an
         *  ERC-20 this broadcasts the encoded `transfer(...)` to the token
         *  contract; for a native send it's a value-only tx. */
        const txHash = await sendCall({
          to: call.to as string, data: call.data, value: call.value, chainId,
        });
        const ref: TransactionReferenceContent = {
          networkId: chainId,
          reference: txHash,
          metadata: {
            transactionType: 'transfer',
            currency: call.metadata?.currency ?? 'ETH',
            ...(call.metadata?.amount != null ? { amount: call.metadata.amount } : {}),
            decimals: call.metadata?.decimals ?? 18,
            toAddress: recipient,
          },
        };
        await xmtpSendTxReference(activeLine, ref);
      } catch (e) {
        flash((e as Error).message || 'Payment failed');
      } finally {
        setPayingIds(prev => { const n = new Set(prev); n.delete(requestId); return n; });
      }
    })();
    };
    const amountLabel = call.metadata?.amount != null
      ? `${call.metadata.amount} ${currency}`
      : `${amount} ${currency}`;
    Alert.alert(
      'Confirm payment',
      `Send ${amountLabel} to ${recipient} on ${chainName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Pay', style: 'default', onPress: broadcast },
      ],
    );
  }, [activeLine]);

  return { signingIds, onSign, payingIds, onPay };
}
