/** Pure helpers + constants for the Wallet → Send screen.
 *
 *  Extracted from send.tsx (mechanical split, behavior identical). */
import { createPublicClient, http, formatEther, type Hex } from 'viem';
import { mainnet } from 'viem/chains';
import { getOrCreateXmtpClient } from '../../lib/xmtp';
import { getSimplePrices } from '../../lib/coingecko';

export const MULTICALL3 = '0xcA11bde05977b3631167028862bE2a173976CA11' as const;
export const multicall3Abi = [{
  name: 'getEthBalance', type: 'function', stateMutability: 'view',
  inputs: [{ name: 'a', type: 'address' }],
  outputs: [{ name: 'b', type: 'uint256' }],
}] as const;

export function looksLikeEns(s: string): boolean {
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+\.eth$|^[a-z0-9-]+\.eth$/i.test(s.trim());
}

/** Pull the connected wallet's ETH balance + the live ETH price so `Max` and the
 *  USD↔ETH conversion have real numbers to work with. Returns nulls on failure
 *  (UI degrades to a basic Send form). */
export async function fetchBalanceAndPrice(): Promise<{
  ethBalance: string | null;
  ethPriceUsd: number | null;
}> {
  const client = await getOrCreateXmtpClient('production');
  const addr = client.publicIdentity.identifier as Hex;
  const pub = createPublicClient({ chain: mainnet, transport: http('https://rpc.brovider.xyz/1') });
  const [bal, prices] = await Promise.all([
    pub.readContract({ address: MULTICALL3, abi: multicall3Abi, functionName: 'getEthBalance', args: [addr] }),
    getSimplePrices(['ethereum']).catch(() => ({} as Record<string, { usd: number }>)),
  ]);
  const p = prices['ethereum']?.usd;
  return {
    ethBalance: formatEther(bal as bigint),
    ethPriceUsd: typeof p === 'number' ? p : null,
  };
}
