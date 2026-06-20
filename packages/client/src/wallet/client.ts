
import { createPublicClient, http, type Chain, type PublicClient } from 'viem';
import { VIEM_CHAINS } from './assets';

export function broviderRpc(chainId: number): string {
  return `https://rpc.brovider.xyz/${chainId}`;
}

export function broviderTransport(chainId: number) {
  return http(broviderRpc(chainId));
}

export function chainFor(chainId: number): Chain {
  const known = VIEM_CHAINS[chainId];
  if (known) return known;
  const rpc = broviderRpc(chainId);
  return {
    id: chainId,
    name: `Chain ${chainId}`,
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [rpc] }, public: { http: [rpc] } },
  };
}

export function publicClientFor(chainId: number): PublicClient {
  return createPublicClient({
    chain: chainFor(chainId),
    transport: broviderTransport(chainId),
  });
}
