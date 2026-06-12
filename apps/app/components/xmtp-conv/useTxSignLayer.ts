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
import { deriveConfirmSummary, confirmMessage } from '../../lib/txConfirm';
import { deriveSignSummary, signConfirmMessage } from '../../lib/signConfirm';
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
   *  request card flips to a "Signed ✓" receipt for everyone.
   *
   *  SECURITY: a signature is produced from an UNTRUSTED peer's request and a
   *  single tap can authorize a Permit/Permit2/EIP-3009/Seaport allowance that
   *  drains the wallet LATER. So, exactly like onPay, we ALWAYS confirm before
   *  signing. The confirm summary is derived from the typed-data STRUCTURE
   *  (deriveSignSummary), never from the peer's free-text `description`, and a
   *  recognised high-risk primaryType gets an explicit warning + destructive
   *  button. The actual signing only runs from the confirm sheet's onPress. */
  const onSign = useCallback((requestId: string, req: SignatureRequestContent) => {
    const summary = deriveSignSummary(req);
    const doSign = (): void => {
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
    const chainName = VIEM_CHAINS[chainId]?.name ?? `chain ${chainId}`;
    const nativeSymbol = VIEM_CHAINS[chainId]?.nativeCurrency?.symbol ?? 'ETH';
    /** SECURITY: derive the displayed recipient/amount/token from the ACTUAL
     *  bytes that will be broadcast (`call.to` / `call.data` / `call.value`),
     *  NOT from the peer-supplied `metadata` (which is unbound to the calldata
     *  and trivially spoofable). For an ERC-20 this decodes
     *  `transfer(address,uint256)` from `call.data`; for a native send it reads
     *  `call.to` + `call.value`. An undecodable / unrecognised call yields an
     *  unverified summary so the confirm sheet warns instead of lying. */
    const summary = deriveConfirmSummary(
      { to: call.to, data: call.data, value: call.value },
      nativeSymbol,
    );
    /** This moves real funds, so confirm before broadcast; the message is built
     *  from the verified summary, never the spoofable metadata hints. */
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
        /** Receipt metadata is built from the VERIFIED summary (decoded from the
         *  broadcast bytes), so the on-chain truth, not the request's hints, is
         *  what the receipt card shows. */
        const ref: TransactionReferenceContent = {
          networkId: chainId,
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
        flash((e as Error).message || 'Payment failed');
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
