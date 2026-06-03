/** Block-explorer URL helper keyed by chainId. The shield flow defaults to
 *  Sepolia (testnet) for the first on-chain write, so a hardcoded mainnet
 *  etherscan.io link points at the wrong network — this maps each supported
 *  chain to its correct explorer host. */

const EXPLORER_HOST: Record<number, string> = {
  1: 'https://etherscan.io',
  11155111: 'https://sepolia.etherscan.io',
};

/** Explorer tx URL for a chainId; falls back to Sepolia (the shield default). */
export function txExplorerUrl(chainId: number, txHash: string): string {
  const host = EXPLORER_HOST[chainId] ?? EXPLORER_HOST[11155111];
  return `${host}/tx/${txHash}`;
}
