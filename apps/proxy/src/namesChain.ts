import { createPublicClient, createWalletClient, http, keccak256, namehash, stringToBytes, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import { BASENAME_REGISTRY } from '@stage-labs/client/identity/onchainProfile';
import { STAGE_NAMES_PARENT, stageNameOf } from '@stage-labs/client/identity/stageNames';
import type { NamesChain } from './namesTypes.ts';

const ZERO = '0x0000000000000000000000000000000000000000';

const REGISTRY_ABI = [
  {
    name: 'owner', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'node', type: 'bytes32' }], outputs: [{ type: 'address' }],
  },
  {
    name: 'resolver', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'node', type: 'bytes32' }], outputs: [{ type: 'address' }],
  },
  {
    name: 'setSubnodeRecord', type: 'function', stateMutability: 'nonpayable',
    inputs: [
      { name: 'node', type: 'bytes32' }, { name: 'label', type: 'bytes32' }, { name: 'owner', type: 'address' },
      { name: 'resolver', type: 'address' }, { name: 'ttl', type: 'uint64' },
    ],
    outputs: [],
  },
  {
    name: 'setOwner', type: 'function', stateMutability: 'nonpayable',
    inputs: [{ name: 'node', type: 'bytes32' }, { name: 'owner', type: 'address' }], outputs: [],
  },
] as const;

const RESOLVER_ABI = [
  {
    name: 'setAddr', type: 'function', stateMutability: 'nonpayable',
    inputs: [{ name: 'node', type: 'bytes32' }, { name: 'a', type: 'address' }], outputs: [],
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
    if (receipt.status !== 'success') throw new Error(`transaction ${hash} reverted`);
    return hash;
  };

  return {
    operator: account.address,
    verifyClaim: (address, message, signature) => publicClient.verifyMessage({ address, message, signature }),
    subnameOwner: async (label) => {
      const owner = await publicClient.readContract({ ...registry, functionName: 'owner', args: [namehash(stageNameOf(label))] });
      return owner === ZERO ? null : owner;
    },
    issue: async (label, owner) => {
      const node = namehash(stageNameOf(label));
      const resolver = await publicClient.readContract({ ...registry, functionName: 'resolver', args: [parentNode] });
      if (resolver === ZERO) throw new Error('parent name has no resolver');
      await mined(await wallet.writeContract({
        ...registry, functionName: 'setSubnodeRecord',
        args: [parentNode, keccak256(stringToBytes(label)), account.address, resolver, 0n],
      }));
      await mined(await wallet.writeContract({ address: resolver, abi: RESOLVER_ABI, functionName: 'setAddr', args: [node, owner] }));
      return mined(await wallet.writeContract({ ...registry, functionName: 'setOwner', args: [node, owner] }));
    },
  };
}
