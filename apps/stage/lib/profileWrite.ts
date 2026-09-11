import { base } from 'viem/chains';
import type { Hex } from 'viem';
import { encodeSetBasenameAvatar, type ContractCall } from '@stage-labs/client/identity/basenameWrite';
import { namehash } from 'viem';
import { normalize } from 'viem/ens';
import { makeProfileClients, resolverForNode } from '@stage-labs/client/identity/onchainProfile';
import { broviderRpc } from '@stage-labs/client/wallet/client';
import { getActiveAccount } from './accounts';
import { invalidatePeerProfile } from './peerProfiles';
import { uploadAvatar } from './profile';
import { sendCall } from './tx';
import { kernelClientForRecord } from './zerodev/kernelForRecord';

export async function sendOnBase(call: ContractCall): Promise<Hex> {
  const active = await getActiveAccount();
  if (!active) throw new Error('No active account');
  if (active.type === 'smart') {
    const kernel = await kernelClientForRecord(active);
    return kernel.sendTransaction({ to: call.to, data: call.data, value: 0n } as Parameters<typeof kernel.sendTransaction>[0]);
  }
  return sendCall({ to: call.to, data: call.data, chainId: base.id });
}

export async function setBasenameAvatar(
  address: string, name: string, image: { uri: string; mime: string; name?: string },
): Promise<Hex> {
  const uri = await uploadAvatar(image.uri, image.mime, image.name ?? 'avatar');
  const resolver = await resolverForNode(makeProfileClients(broviderRpc).base, namehash(normalize(name)));
  const hash = await sendOnBase(encodeSetBasenameAvatar(name, uri, resolver ?? undefined));
  invalidatePeerProfile(address);
  return hash;
}
