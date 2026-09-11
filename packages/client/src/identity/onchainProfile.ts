import { createPublicClient, encodePacked, http, keccak256, namehash, stringToBytes, type Hex, type PublicClient } from 'viem';

export const PROFILE_TEXT_KEYS = { displayName: 'name', description: 'description', avatar: 'avatar' } as const;
import { normalize } from 'viem/ens';
import { base } from 'viem/chains';

export const BASENAME_REGISTRY = '0xB94704422c2a1E396835A571837Aa5AE53285a95' as const;
export const BASENAME_L2_RESOLVER = '0xC6d566A56A1aFf6508b41f6c90ff131615583BCD' as const;

export const REGISTRY_ABI = [
  {
    name: 'resolver', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'node', type: 'bytes32' }],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'owner', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'node', type: 'bytes32' }],
    outputs: [{ name: '', type: 'address' }],
  },
] as const;

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
  displayName?: string;
  description?: string;
  avatar?: string;
  source: OnchainProfileSource;
}

export function avatarCacheKey(avatar: string | undefined): string | undefined {
  return avatar === undefined ? undefined : keccak256(stringToBytes(avatar)).slice(2, 10);
}

function nonEmpty(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
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

const ZERO_ADDRESS: Hex = '0x0000000000000000000000000000000000000000';

export async function resolverForNode(client: PublicClient, node: Hex): Promise<Hex | null> {
  const resolver: Hex = await client.readContract({
    address: BASENAME_REGISTRY, abi: REGISTRY_ABI, functionName: 'resolver', args: [node],
  }).catch(() => ZERO_ADDRESS);
  return resolver === ZERO_ADDRESS ? null : resolver;
}

export async function resolveBasenameProfile(client: PublicClient, address: string): Promise<OnchainProfile | null> {
  const reverseNode = baseReverseNode(address);
  const reverseResolver = (await resolverForNode(client, reverseNode)) ?? BASENAME_L2_RESOLVER;
  const name = await client.readContract({
    address: reverseResolver, abi: L2_RESOLVER_ABI, functionName: 'name', args: [reverseNode],
  });
  if (!name) return null;
  const node = namehash(normalize(name));
  const resolverAddress = (await resolverForNode(client, node)) ?? BASENAME_L2_RESOLVER;
  const resolver = { address: resolverAddress, abi: L2_RESOLVER_ABI } as const;
  const text = (key: string): Promise<string> =>
    client.readContract({ ...resolver, functionName: 'text', args: [node, key] }).catch(() => '');
  const [forward, avatar, displayName, description] = await Promise.all([
    client.readContract({ ...resolver, functionName: 'addr', args: [node] }),
    text(PROFILE_TEXT_KEYS.avatar),
    text(PROFILE_TEXT_KEYS.displayName),
    text(PROFILE_TEXT_KEYS.description),
  ]);
  if (forward.toLowerCase() !== address.toLowerCase()) return null;
  return {
    name, displayName: nonEmpty(displayName), description: nonEmpty(description), avatar: usableAvatarUri(avatar), source: 'basename',
  };
}

export async function resolveOnchainProfile(clients: ProfileClients, address: string): Promise<OnchainProfile | null> {
  return resolveBasenameProfile(clients.base, address).catch(() => null);
}
