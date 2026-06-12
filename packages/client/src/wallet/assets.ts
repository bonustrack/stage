/** Wallet asset registry + network metadata. Framework-agnostic (viem types +
 *  plain data); shared by the wallet surfaces. Moved out of apps/app's
 *  WalletScreen.assets for the Stage SDK. */

import type { Hex, Chain } from 'viem';
import { mainnet, sepolia, base } from 'viem/chains';

/** Sentinel address Snapshot uses for native ETH on stamp.fyi. Matches
 *  sx-monorepo's `ETH_CONTRACT` (and kit's NATIVE_TOKEN_SENTINEL). Inlined here
 *  so packages/client stays standalone (no @metro-labs/kit dependency). */
export const NATIVE_TOKEN_SENTINEL = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

export const MULTICALL3 = '0xcA11bde05977b3631167028862bE2a173976CA11' as const;

/** Asset registry — ETH + the stablecoins. `address: null` is the special
 *  "native" row; everything else is an ERC-20. `cgId` lets us hit the
 *  simple-price endpoint for ETH (the contract-price endpoint doesn't cover
 *  native coins). `logoAddress` is the contract used to fetch the token icon. */
export interface Asset {
  symbol: string;
  name: string;
  decimals: number;
  /** Chain this asset lives on (1 = Ethereum, 8453 = Base, 11155111 = Sepolia testnet). */
  chainId: number;
  address: Hex | null;
  logoAddress: string;
  /** coingecko id for native price lookup. */
  cgId?: string;
  /** CoinGecko asset-platform id for the contract-price endpoint (`ethereum`).
   *  Only set for ERC-20 rows. */
  cgPlatform?: string;
  /** Contract address used for the CoinGecko price lookup. Defaults to
   *  `address`, but testnet ERC-20s (Sepolia USDC) reuse the mainnet contract on
   *  the `ethereum` platform so the $ column isn't blank. */
  priceAddress?: Hex;
}

export const ASSETS: Asset[] = [
  { symbol: 'ETH',  name: 'Ethereum',  decimals: 18, chainId: 1,        address: null, logoAddress: NATIVE_TOKEN_SENTINEL, cgId: 'ethereum' },
  { symbol: 'USDC', name: 'USD Coin',  decimals: 6,  chainId: 1,        address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', logoAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', cgPlatform: 'ethereum' },
  { symbol: 'ETH',  name: 'Ethereum',  decimals: 18, chainId: 11155111, address: null, logoAddress: NATIVE_TOKEN_SENTINEL, cgId: 'ethereum' },
  { symbol: 'USDC', name: 'USD Coin',  decimals: 6,  chainId: 11155111, address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', logoAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', cgPlatform: 'ethereum', priceAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
  // Base (chain 8453). Native ETH prices off the same `ethereum` CoinGecko id;
  // USDC is native Circle USDC on Base and lists on the `base` platform. USDC is
  // also the settlement currency for x402 challenges.
  { symbol: 'ETH',  name: 'Ethereum',  decimals: 18, chainId: 8453, address: null, logoAddress: NATIVE_TOKEN_SENTINEL, cgId: 'ethereum' },
  { symbol: 'USDC', name: 'USD Coin',  decimals: 6,  chainId: 8453, address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', logoAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', cgPlatform: 'base', priceAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' },
  // STAGE (ERC-20 Votes) — Sepolia governance token. No CoinGecko listing, so no
  // price row (the $ column stays blank); the logo falls back to the stamp.fyi
  // identicon for its own contract address.
  { symbol: 'STAGE', name: 'Stage', decimals: 18, chainId: 11155111, address: '0x7a49F33AD000220a764ED303f9911cB08422d138', logoAddress: '0x7a49F33AD000220a764ED303f9911cB08422d138' },
];

/** Network bullets — Ethereum is Snapshot's IPFS-hosted logo; Sepolia is the
 *  testnet IPFS mark. Keyed by chainId so the renderer can drop the right badge
 *  over each token avatar. */
export const MAINNET_NETWORK_LOGO = 'https://ipfs.snapshot.box/ipfs/bafkreid7ndxh6y2ljw2jhbisodiyrhcy2udvnwqgon5wgells3kh4si5z4';
export const SEPOLIA_NETWORK_LOGO = 'https://ipfs.snapshot.box/ipfs/bafkreif5b7trz7plh4mpfbnom2wqc6yogux6sgzwau6znwu7pbq6qeu63e';
export const BASE_NETWORK_LOGO = 'https://ipfs.snapshot.box/ipfs/bafkreid4ek4gnj6ccxl3yubwj2wr3d5t6dqelvvh4hv5wo5eldkqs725ri';
export const NETWORK_LOGO: Record<number, string> = {
  1: MAINNET_NETWORK_LOGO,
  8453: BASE_NETWORK_LOGO,
  84532: BASE_NETWORK_LOGO, // Base Sepolia reuses the Base mark (x402 demo runs here)
  11155111: SEPOLIA_NETWORK_LOGO,
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
  /** Chain this row's asset lives on — drives the network badge + label. */
  chainId: number;
  /** Decimal-string balance (`formatUnits` output). */
  balance: string;
  /** USD price per unit, or null when CoinGecko didn't return this asset. */
  priceUsd: number | null;
  /** 24-hour percentage change for the asset's USD price. */
  change24h: number | null;
  /** Cached logo URL (stamp.fyi) so the renderer doesn't recompute per row. */
  logoUrl: string;
  /** True for Railgun-shielded balances merged into the public Tokens list. */
  isPrivate?: boolean;
}
