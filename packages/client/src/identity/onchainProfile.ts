import { createPublicClient, encodePacked, http, keccak256, namehash, stringToBytes, type Hex, type PublicClient } from 'viem';
import { normalize } from 'viem/ens';
import { base, mainnet } from 'viem/chains';

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

export type OnchainProfileSource = 'ens' | 'basename';

export interface OnchainProfile {
  name: string;
  avatar?: string;
  source: OnchainProfileSource;
}

export interface ProfileClients {
  mainnet: PublicClient;
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
  const make = (chain: typeof mainnet | typeof base): PublicClient =>
    createPublicClient({ chain, transport: http(rpcUrlFor(chain.id)), batch: { multicall: true } }) as PublicClient;
  return { mainnet: make(mainnet), base: make(base) };
}

export async function resolveEnsProfile(client: PublicClient, address: string): Promise<OnchainProfile | null> {
  const name = await client.getEnsName({ address: address as Hex });
  if (!name) return null;
  const avatar = await client.getEnsAvatar({ name: normalize(name) }).catch(() => null);
  return { name, avatar: usableAvatarUri(avatar), source: 'ens' };
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
  const ens = await resolveEnsProfile(clients.mainnet, address).catch(() => null);
  if (ens) return ens;
  return resolveBasenameProfile(clients.base, address).catch(() => null);
}
