import type { Chain } from 'viem';
import { mainnet, sepolia, base } from 'viem/chains';

export const MAINNET_NETWORK_LOGO = 'https://ipfs.snapshot.box/ipfs/bafkreid7ndxh6y2ljw2jhbisodiyrhcy2udvnwqgon5wgells3kh4si5z4';
const SEPOLIA_NETWORK_LOGO = 'https://ipfs.snapshot.box/ipfs/bafkreif5b7trz7plh4mpfbnom2wqc6yogux6sgzwau6znwu7pbq6qeu63e';
const BASE_NETWORK_LOGO = 'https://ipfs.snapshot.box/ipfs/bafkreid4ek4gnj6ccxl3yubwj2wr3d5t6dqelvvh4hv5wo5eldkqs725ri';
const FALLBACK_EXPLORER = 'https://etherscan.io';

interface ChainEntry {
  id: number;
  label: string;
  x402Names: readonly string[];
  viem?: Chain;
  logo?: string;
  explorer?: string;
}

const CHAINS: readonly ChainEntry[] = [
  { id: 1, label: 'Ethereum', x402Names: ['eip155:1', 'ethereum'], viem: mainnet, logo: MAINNET_NETWORK_LOGO, explorer: FALLBACK_EXPLORER },
  { id: 8453, label: 'Base', x402Names: ['eip155:8453', 'base'], viem: base, logo: BASE_NETWORK_LOGO, explorer: 'https://basescan.org' },
  { id: 84532, label: 'Base Sepolia', x402Names: ['eip155:84532', 'base-sepolia'], logo: BASE_NETWORK_LOGO },
  {
    id: 11155111,
    label: 'Sepolia',
    x402Names: ['eip155:11155111', 'sepolia'],
    viem: sepolia,
    logo: SEPOLIA_NETWORK_LOGO,
    explorer: 'https://sepolia.etherscan.io',
  },
  { id: 10, label: 'Optimism', x402Names: ['eip155:10'], explorer: 'https://optimistic.etherscan.io' },
  { id: 137, label: 'Polygon', x402Names: ['eip155:137'], explorer: 'https://polygonscan.com' },
  { id: 42161, label: 'Arbitrum', x402Names: ['eip155:42161'], explorer: 'https://arbiscan.io' },
  { id: 43114, label: 'Avalanche', x402Names: ['eip155:43114'] },
];

export const WALLET_CHAIN_ID = base.id;

export const WALLET_CHAIN_ONLY = 'Your Stage wallet pays on Base only.';

export function isWalletChain(chainId: number): boolean {
  return chainId === WALLET_CHAIN_ID;
}

export const VIEM_CHAINS: Readonly<Record<number, Chain>> = Object.fromEntries(
  CHAINS.flatMap((c) => (c.viem === undefined ? [] : [[c.id, c.viem]])),
);

export function viemChainName(chainId: number): string | undefined {
  return VIEM_CHAINS[chainId]?.name;
}

export function networkLogo(chainId: number): string {
  return CHAINS.find((c) => c.id === chainId)?.logo ?? MAINNET_NETWORK_LOGO;
}

export function explorerUrl(chainId: number): string {
  return CHAINS.find((c) => c.id === chainId)?.explorer ?? FALLBACK_EXPLORER;
}

export function x402Network(network: string): { chainId: number; label: string } | undefined {
  const key = network.trim().toLowerCase();
  const hit = CHAINS.find((c) => c.x402Names.includes(key));
  return hit === undefined ? undefined : { chainId: hit.id, label: hit.label };
}
