
import type { Hex, Chain } from 'viem';
import { mainnet, sepolia, base } from 'viem/chains';

export const NATIVE_TOKEN_SENTINEL = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

export const MULTICALL3 = '0xcA11bde05977b3631167028862bE2a173976CA11' as const;

export interface Asset {
  symbol: string;
  name: string;
  decimals: number;
  chainId: number;
  address: Hex | null;
  logoAddress: string;
  cgId?: string;
  cgPlatform?: string;
  priceAddress?: Hex;
}

export const ASSETS: Asset[] = [
  { symbol: 'ETH',  name: 'Ethereum',  decimals: 18, chainId: 1,        address: null, logoAddress: NATIVE_TOKEN_SENTINEL, cgId: 'ethereum' },
  { symbol: 'USDC', name: 'USD Coin',  decimals: 6,  chainId: 1,        address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', logoAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', cgPlatform: 'ethereum' },
  { symbol: 'ETH',  name: 'Ethereum',  decimals: 18, chainId: 11155111, address: null, logoAddress: NATIVE_TOKEN_SENTINEL, cgId: 'ethereum' },
  { symbol: 'USDC', name: 'USD Coin',  decimals: 6,  chainId: 11155111, address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', logoAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', cgPlatform: 'ethereum', priceAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
  { symbol: 'ETH',  name: 'Ethereum',  decimals: 18, chainId: 8453, address: null, logoAddress: NATIVE_TOKEN_SENTINEL, cgId: 'ethereum' },
  { symbol: 'USDC', name: 'USD Coin',  decimals: 6,  chainId: 8453, address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', logoAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', cgPlatform: 'base', priceAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' },
  { symbol: 'STAGE', name: 'Stage', decimals: 18, chainId: 11155111, address: '0x7a49F33AD000220a764ED303f9911cB08422d138', logoAddress: '0x7a49F33AD000220a764ED303f9911cB08422d138' },
];

export const MAINNET_NETWORK_LOGO = 'https://ipfs.snapshot.box/ipfs/bafkreid7ndxh6y2ljw2jhbisodiyrhcy2udvnwqgon5wgells3kh4si5z4';
export const SEPOLIA_NETWORK_LOGO = 'https://ipfs.snapshot.box/ipfs/bafkreif5b7trz7plh4mpfbnom2wqc6yogux6sgzwau6znwu7pbq6qeu63e';
export const BASE_NETWORK_LOGO = 'https://ipfs.snapshot.box/ipfs/bafkreid4ek4gnj6ccxl3yubwj2wr3d5t6dqelvvh4hv5wo5eldkqs725ri';
export const NETWORK_LOGO: Record<number, string> = {
  1: MAINNET_NETWORK_LOGO,
  8453: BASE_NETWORK_LOGO,
  84532: BASE_NETWORK_LOGO,
  11155111: SEPOLIA_NETWORK_LOGO,
};

export const NETWORK_LABEL: Record<number, string> = {
  1: 'Ethereum',
  8453: 'Base',
  84532: 'Base Sepolia',
  11155111: 'Sepolia',
};

export const VIEM_CHAINS: Record<number, Chain> = { 1: mainnet, 8453: base, 11155111: sepolia };

export const erc20Abi = [{
  name: 'balanceOf', type: 'function', stateMutability: 'view',
  inputs: [{ name: 'a', type: 'address' }],
  outputs: [{ name: 'b', type: 'uint256' }],
}] as const;

export const multicall3Abi = [{
  name: 'getEthBalance', type: 'function', stateMutability: 'view',
  inputs: [{ name: 'a', type: 'address' }],
  outputs: [{ name: 'b', type: 'uint256' }],
}] as const;

export interface AssetRow {
  symbol: string;
  name: string;
  chainId: number;
  balance: string;
  priceUsd: number | null;
  change24h: number | null;
  logoUrl: string;
  isPrivate?: boolean;
}
