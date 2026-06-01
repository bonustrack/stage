/** Wallet asset registry + network metadata — extracted from WalletScreen for
 *  lint line-budget. Behaviour identical. */

import type { Hex, Chain } from 'viem';
import { mainnet, base } from 'viem/chains';
import { NATIVE_TOKEN_SENTINEL } from '@metro-labs/kit/avatar';

export const MULTICALL3 = '0xcA11bde05977b3631167028862bE2a173976CA11' as const;

/** Asset registry — ETH + the two stablecoins Less called out in the review.
 *  `address: null` is the special "native" row; everything else is an ERC-20
 *  on Ethereum mainnet. `cgId` lets us hit the simple-price endpoint for ETH
 *  (the contract-price endpoint doesn't cover native coins).
 *
 *  `logoAddress` is the contract address used to fetch the token icon from
 *  `cdn.stamp.fyi` — Snapshot UI uses the canonical ETH sentinel for
 *  native ETH; stamp.fyi serves it from a curated set. */
export interface Asset {
  symbol: string; name: string; decimals: number;
  /** Chain this asset lives on (1 = Ethereum, 8453 = Base). */
  chainId: number;
  address: Hex | null;
  logoAddress: string;
  cgId?: string;        // coingecko id for native price lookup
  /** CoinGecko asset-platform id for the contract-price endpoint
   *  (`ethereum`, `base`). Only set for ERC-20 rows. */
  cgPlatform?: string;
}
export const ASSETS: Asset[] = [
  { symbol: 'ETH',  name: 'Ethereum',  decimals: 18, chainId: 1,    address: null, logoAddress: NATIVE_TOKEN_SENTINEL, cgId: 'ethereum' },
  { symbol: 'USDC', name: 'USD Coin',  decimals: 6,  chainId: 1,    address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', logoAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', cgPlatform: 'ethereum' },
  { symbol: 'ETH',  name: 'Ethereum',  decimals: 18, chainId: 8453, address: null, logoAddress: NATIVE_TOKEN_SENTINEL, cgId: 'ethereum' },
  { symbol: 'USDC', name: 'USD Coin',  decimals: 6,  chainId: 8453, address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', logoAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', cgPlatform: 'base' },
];
/** Network bullets — Ethereum is Snapshot's IPFS-hosted logo (the UI's
 *  `BadgeNetwork`); Base is the canonical brand mark. Keyed by chainId so the
 *  renderer can drop the right badge over each token avatar. */
export const MAINNET_NETWORK_LOGO = 'https://ipfs.snapshot.box/ipfs/bafkreid7ndxh6y2ljw2jhbisodiyrhcy2udvnwqgon5wgells3kh4si5z4';
export const BASE_NETWORK_LOGO = 'https://ipfs.snapshot.box/ipfs/bafkreid4ek4gnj6ccxl3yubwj2wr3d5t6dqelvvh4hv5wo5eldkqs725ri';
export const NETWORK_LOGO: Record<number, string> = { 1: MAINNET_NETWORK_LOGO, 8453: BASE_NETWORK_LOGO };
export const VIEM_CHAINS: Record<number, Chain> = { 1: mainnet, 8453: base };

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
  symbol: string; name: string;
  /** Chain this row's asset lives on — drives the network badge + label. */
  chainId: number;
  /** Decimal-string balance (`formatUnits` output). */
  balance: string;
  /** USD price per unit, or null when CoinGecko didn't return this asset. */
  priceUsd: number | null;
  /** 24-hour percentage change for the asset's USD price. Shown beneath
   *  the per-unit price as +/-x.xx%. */
  change24h: number | null;
  /** Cached logo URL (stamp.fyi) so the renderer doesn't recompute on every row. */
  logoUrl: string;
}
