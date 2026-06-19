/**
 * @file Shared viem public-client and brovider multichain RPC setup for the wallet read surfaces.
 */
/**
 * Shared viem public-client + RPC setup for the wallet surfaces. Framework-
 *  agnostic (viem only). One place owns the brovider multichain RPC base and the
 *  VIEM_CHAINS registry so the app's balance/send/tx readers don't each re-roll
 *  `createPublicClient({ chain, transport: http('https://rpc.brovider.xyz/'+id) })`.
 *
 *  brovider (rpc.brovider.xyz) is a multicall-oriented multichain proxy: the
 *  path segment is the chainId. It is great for the public-wallet reads here
 *  (multicall, getBalance, ERC-20 reads) but REJECTS eth_getLogs, so the Railgun
 *  engine scan must NOT use it — railgun keeps its own client (lib/railgun).
 */

import { createPublicClient, http, type Chain, type PublicClient } from 'viem';
import { VIEM_CHAINS } from './assets';

/** brovider multichain RPC base — the path segment is the chainId. */
export function broviderRpc(chainId: number): string {
  return `https://rpc.brovider.xyz/${chainId}`;
}

/** viem transport pointed at brovider for `chainId`. viem's stock chain defs point `rpcUrls.default` at flaky public endpoints, so always route reads through this instead of a bare `http()`. */
export function broviderTransport(chainId: number) {
  return http(broviderRpc(chainId));
}

/** A viem chain for ANY chainId. Known chains come from VIEM_CHAINS; unknown chains get a minimal generic definition pointed at brovider's per-chain RPC (which fronts a public RPC for most EVM networks). */
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

/** A viem public client for `chainId`, using the brovider RPC. Falls back to a generic chain definition for chainIds not in VIEM_CHAINS. */
export function publicClientFor(chainId: number): PublicClient {
  return createPublicClient({
    chain: chainFor(chainId),
    transport: broviderTransport(chainId),
  });
}
