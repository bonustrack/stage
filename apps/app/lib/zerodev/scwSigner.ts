/** The ONE place that builds an XMTP `Signer` for a smart-contract-wallet (SCW)
 *  identity (spec §3.3 + review item 6: single source of truth, so the chainId
 *  8453 plumbing can never drift across xmtp.codecs / xmtp.recover / xmtp.client
 *  and regress into AssociationError.ChainIdMismatch).
 *
 *  The Kernel address is the XMTP identity. signMessage returns an ERC-1271
 *  blob, auto-wrapped in an ERC-6492 envelope while the Kernel is still
 *  counterfactual (so an UNDEPLOYED account can register an inbox — libxmtp #736).
 *  The identity is chain-bound to Base (8453); every signing path MUST use this
 *  factory so the chainId is identical at registration and afterwards.
 *
 *  NOTE: XMTP's Signer.getChainId is typed `number` (not bigint); the spec's
 *  `8453n` is the on-chain form — here we hand XMTP the number 8453, which is the
 *  same Base chain id in the shape its native registration handler expects. */

import {
  PublicIdentity, type Signer as XmtpSigner,
} from '@xmtp/react-native-sdk';
import type { KernelAccountClient } from '@zerodev/sdk';
import { SCW_CHAIN_ID } from '@stage-labs/client/zerodev/config';

/** Build the SCW XMTP signer from a Kernel account client. `signMessage` signs
 *  with the Kernel (ERC-1271, 6492-wrapped when undeployed). Used by
 *  Client.create / Client.build / revokeInstallations alike. */
export function scwSigner(kernelClient: KernelAccountClient, scwAddress: string): XmtpSigner {
  return {
    getIdentifier: async () => new PublicIdentity(scwAddress, 'ETHEREUM'),
    getChainId: () => SCW_CHAIN_ID,
    getBlockNumber: () => undefined,
    signerType: () => 'SCW',
    signMessage: async (message: string) => {
      /** Kernel ERC-1271 signature; auto 6492-wrapped while counterfactual. */
      const signature = await kernelClient.signMessage({ message });
      return { signature };
    },
  };
}
