import type { Hex } from 'viem';
import { WALLET_CHAIN_ID } from './chains';

export const NATIVE_TOKEN_SENTINEL = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

export const MULTICALL3 = '0xcA11bde05977b3631167028862bE2a173976CA11' as const;

export interface Asset {
  symbol: string;
  name: string;
  decimals: number;
  chainId: number;
  address: Hex | null;
  logoAddress: string;
  priceId?: string;
  transferAuthorization?: true;
}

export const ETH_PRICE_ID = 'ethereum:0x0000000000000000000000000000000000000000';
const USDC_PRICE_ID = 'ethereum:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';

export const ASSETS: Asset[] = [
  { symbol: 'ETH', name: 'Ethereum', decimals: 18, chainId: 1, address: null, logoAddress: NATIVE_TOKEN_SENTINEL, priceId: ETH_PRICE_ID },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    chainId: 1,
    address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    logoAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    priceId: USDC_PRICE_ID,
    transferAuthorization: true,
  },
  {
    symbol: 'ETH',
    name: 'Ethereum',
    decimals: 18,
    chainId: 11155111,
    address: null,
    logoAddress: NATIVE_TOKEN_SENTINEL,
    priceId: ETH_PRICE_ID,
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    chainId: 11155111,
    address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    logoAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    priceId: USDC_PRICE_ID,
    transferAuthorization: true,
  },
  {
    symbol: 'ETH',
    name: 'Ethereum',
    decimals: 18,
    chainId: 8453,
    address: null,
    logoAddress: NATIVE_TOKEN_SENTINEL,
    priceId: ETH_PRICE_ID,
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    chainId: 8453,
    address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    logoAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    priceId: 'base:0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
    transferAuthorization: true,
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    chainId: 84532,
    address: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    logoAddress: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    transferAuthorization: true,
  },
  {
    symbol: 'STAGE',
    name: 'Stage',
    decimals: 18,
    chainId: 11155111,
    address: '0x7a49F33AD000220a764ED303f9911cB08422d138',
    logoAddress: '0x7a49F33AD000220a764ED303f9911cB08422d138',
  },
];

export const WALLET_ASSETS = ASSETS.filter((a) => a.chainId === WALLET_CHAIN_ID);

export const KNOWN_TOKENS: Readonly<Record<string, { symbol: string; decimals: number }>> = Object.fromEntries(
  ASSETS.flatMap((a) =>
    a.transferAuthorization === true && a.address !== null ? [[a.address.toLowerCase(), { symbol: a.symbol, decimals: a.decimals }]] : [],
  ),
);

export const erc20Abi = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'a', type: 'address' }],
    outputs: [{ name: 'b', type: 'uint256' }],
  },
] as const;

export const multicall3Abi = [
  {
    name: 'getEthBalance',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'a', type: 'address' }],
    outputs: [{ name: 'b', type: 'uint256' }],
  },
] as const;

export interface AssetRow {
  symbol: string;
  name: string;
  chainId: number;
  balance: string;
  priceUsd: number | null;
  change24h: number | null;
  logoUrl: string;
}
