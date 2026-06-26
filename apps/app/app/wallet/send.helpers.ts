import { formatEther, type Hex } from 'viem';
import { getOrCreateXmtpClient } from '../../modules/messaging';
import { getSimplePrices } from '../../lib/coingecko';
import type { CgPrice } from '@stage-labs/client/api/coingecko';
import { publicClientFor } from '@stage-labs/client/wallet/client';

export const MULTICALL3 = '0xcA11bde05977b3631167028862bE2a173976CA11' as const;
export const multicall3Abi = [{
  name: 'getEthBalance', type: 'function', stateMutability: 'view',
  inputs: [{ name: 'a', type: 'address' }],
  outputs: [{ name: 'b', type: 'uint256' }],
}] as const;

export async function fetchBalanceAndPrice(): Promise<{
  ethBalance: string | null;
  ethPriceUsd: number | null;
}> {
  const client = await getOrCreateXmtpClient('production');
  const addr = client.publicIdentity.identifier as Hex;
  const pub = publicClientFor(1);
  const [bal, prices] = await Promise.all([
    pub.readContract({ address: MULTICALL3, abi: multicall3Abi, functionName: 'getEthBalance', args: [addr] }),
    getSimplePrices(['ethereum']).catch((): Record<string, CgPrice> => ({})),
  ]);
  const p = prices.ethereum?.usd;
  return {
    ethBalance: formatEther(bal),
    ethPriceUsd: typeof p === 'number' ? p : null,
  };
}
