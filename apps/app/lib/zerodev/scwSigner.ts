/**
 * @file The single source of truth that builds an XMTP `Signer` for a smart-contract-wallet identity, binding the Kernel address to Base (8453) and signing via ERC-1271 (ERC-6492-wrapped while still counterfactual) so the chainId can never drift into AssociationError.ChainIdMismatch.
 */

import {
  PublicIdentity, type Signer as XmtpSigner,
} from '@xmtp/react-native-sdk';
import type { KernelAccountClient } from '@zerodev/sdk';
import { SCW_CHAIN_ID } from './config';

/** Build the SCW XMTP signer from a Kernel account client. `signMessage` signs with the Kernel (ERC-1271, 6492-wrapped when undeployed). Used by Client.create / Client.build / revokeInstallations alike. */
export function scwSigner(kernelClient: KernelAccountClient, scwAddress: string): XmtpSigner {
  return {
    getIdentifier: () => Promise.resolve(new PublicIdentity(scwAddress, 'ETHEREUM')),
    getChainId: () => SCW_CHAIN_ID,
    getBlockNumber: () => undefined,
    signerType: () => 'SCW',
    signMessage: async (message: string) => {
      /** Kernel ERC-1271 signature; auto 6492-wrapped while counterfactual. */
      const signature = await kernelClient.signMessage({ message } as Parameters<typeof kernelClient.signMessage>[0]);
      return { signature };
    },
  };
}
