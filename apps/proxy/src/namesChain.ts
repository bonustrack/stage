import { createPublicClient, createWalletClient, http, keccak256, namehash, stringToBytes, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import { BASENAME_REGISTRY, REGISTRY_ABI as BASENAME_REGISTRY_ABI } from '@stage-labs/client/identity/onchainProfile';
import { STAGE_NAMES_PARENT, stageNameOf } from '@stage-labs/client/identity/stageNames';
import type { NamesChain } from './namesTypes.ts';

export const NAME_TAKEN = 'name already taken';
const ZERO = '0x0000000000000000000000000000000000000000';

export class NameTransactionRevertedError extends Error {
  constructor(hash: Hex) {
    super(`transaction ${hash} reverted`);
    this.name = 'NameTransactionRevertedError';
  }
}

const REGISTRY_ABI = [
  ...BASENAME_REGISTRY_ABI,
  {
    name: 'setSubnodeRecord',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'node', type: 'bytes32' },
      { name: 'label', type: 'bytes32' },
      { name: 'owner', type: 'address' },
      { name: 'resolver', type: 'address' },
      { name: 'ttl', type: 'uint64' },
    ],
    outputs: [],
  },
] as const;

export function makeNamesChain(operatorKey: Hex, rpcUrl: string): NamesChain {
  const transport = http(rpcUrl);
  const publicClient = createPublicClient({ chain: base, transport });
  const account = privateKeyToAccount(operatorKey);
  const wallet = createWalletClient({ account, chain: base, transport });
  const parentNode = namehash(STAGE_NAMES_PARENT);
  const registry = { address: BASENAME_REGISTRY, abi: REGISTRY_ABI } as const;

  const mined = async (hash: Hex): Promise<Hex> => {
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== 'success') throw new NameTransactionRevertedError(hash);
    return hash;
  };

  return {
    verifyClaim: (address, message, signature) => publicClient.verifyMessage({ address, message, signature }),
    subnameOwner: async (label) => {
      const owner = await publicClient.readContract({ ...registry, functionName: 'owner', args: [namehash(stageNameOf(label))] });
      return owner === ZERO || owner.toLowerCase() === account.address.toLowerCase() ? null : owner;
    },
    confirm: mined,
    issue: async (label, owner, onSubmitted) => {
      const node = namehash(stageNameOf(label));
      const resolver = await publicClient.readContract({ ...registry, functionName: 'resolver', args: [parentNode] });
      if (resolver === ZERO) throw new Error('parent name has no resolver');
      const current = await publicClient.readContract({ ...registry, functionName: 'owner', args: [node] });
      if (current !== ZERO && current.toLowerCase() !== account.address.toLowerCase()) throw new Error(NAME_TAKEN);
      const hash = await wallet.writeContract({
        ...registry,
        functionName: 'setSubnodeRecord',
        args: [parentNode, keccak256(stringToBytes(label)), owner, resolver, 0n],
      });
      await onSubmitted?.(hash);
      return mined(hash);
    },
  };
}
