
import {
  PublicIdentity, type Signer as XmtpSigner,
} from '@xmtp/react-native-sdk';
import type { KernelAccountClient } from '@zerodev/sdk';
import { SCW_CHAIN_ID } from './config';

export function scwSigner(kernelClient: KernelAccountClient, scwAddress: string): XmtpSigner {
  return {
    getIdentifier: () => Promise.resolve(new PublicIdentity(scwAddress, 'ETHEREUM')),
    getChainId: () => SCW_CHAIN_ID,
    getBlockNumber: () => undefined,
    signerType: () => 'SCW',
    signMessage: async (message: string) => {
      const signature = await kernelClient.signMessage({ message } as Parameters<typeof kernelClient.signMessage>[0]);
      return { signature };
    },
  };
}
