import { createPublicClient, encodePacked, http, keccak256, namehash, stringToBytes, type Hex, type PublicClient } from 'viem';
import { normalize } from 'viem/ens';
import { base } from 'viem/chains';

export const BASENAME_L2_RESOLVER = '0xC6d566A56A1aFf6508b41f6c90ff131615583BCD' as const;

export const L2_RESOLVER_ABI = [
  {
    name: 'name', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'node', type: 'bytes32' }],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    name: 'addr', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'node', type: 'bytes32' }],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'text', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'node', type: 'bytes32' }, { name: 'key', type: 'string' }],
    outputs: [{ name: '', type: 'string' }],
  },
] as const;

export type OnchainProfileSource = 'basename';

export interface OnchainProfile {
  name: string;
  avatar?: string;
  source: OnchainProfileSource;
}

export interface ProfileClients {
  base: PublicClient;
}

export function baseCoinType(chainId: number): string {
  return ((0x80000000 | chainId) >>> 0).toString(16).toUpperCase();
}

export function baseReverseNode(address: string, chainId = base.id): Hex {
  const addressNode = keccak256(stringToBytes(address.slice(2).toLowerCase()));
  const chainReverseNode = namehash(`${baseCoinType(chainId)}.reverse`);
  return keccak256(encodePacked(['bytes32', 'bytes32'], [chainReverseNode, addressNode]));
}

export function isBasename(name: string): boolean {
  return name.toLowerCase().endsWith('.base.eth');
}

export function usableAvatarUri(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim() ?? '';
  if (/^(https?:\/\/|ipfs:\/\/|data:image\/)/i.test(trimmed)) return trimmed;
  return undefined;
}

export function makeProfileClients(rpcUrlFor: (chainId: number) => string): ProfileClients {
  const client = createPublicClient({
    chain: base, transport: http(rpcUrlFor(base.id)), batch: { multicall: true },
  }) as PublicClient;
  return { base: client };
}

export async function resolveBasenameProfile(client: PublicClient, address: string): Promise<OnchainProfile | null> {
  const resolver = { address: BASENAME_L2_RESOLVER, abi: L2_RESOLVER_ABI } as const;
  const name = await client.readContract({ ...resolver, functionName: 'name', args: [baseReverseNode(address)] });
  if (!name) return null;
  const node = namehash(normalize(name));
  const [forward, avatar] = await Promise.all([
    client.readContract({ ...resolver, functionName: 'addr', args: [node] }),
    client.readContract({ ...resolver, functionName: 'text', args: [node, 'avatar'] }).catch(() => ''),
  ]);
  if (forward.toLowerCase() !== address.toLowerCase()) return null;
  return { name, avatar: usableAvatarUri(avatar), source: 'basename' };
}

export async function resolveOnchainProfile(clients: ProfileClients, address: string): Promise<OnchainProfile | null> {
  return resolveBasenameProfile(clients.base, address).catch(() => null);
}
