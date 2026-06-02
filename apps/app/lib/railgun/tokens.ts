/** Railgun shielded-token registry for the Private tab balance display.
 *
 *  Railgun keys shielded balances by ERC20 contract address. Native ETH is
 *  shielded as the network's WRAPPED base token (WETH) — the engine reports
 *  WETH's contract address in its erc20Amounts, so to show an "ETH" row we match
 *  the WETH address per network and relabel it. The WETH addresses below are the
 *  `wrappedAddress` from @railgun-community/shared-models NETWORK_CONFIG (7.5.0,
 *  the version bundled in the shipped engine), so they match the engine's rows
 *  exactly. USDC is the canonical Circle ERC20 per network.
 *
 *  We display a FIXED set (ETH + USDC) per network, even at zero, so the tab is
 *  predictable — a row shows the formatted shielded balance, defaulting to 0
 *  when the scan hasn't surfaced an amount yet. */
import type { RailgunNet } from './networks';

export interface TokenMeta {
  symbol: string;
  /** Lowercased ERC20 contract address Railgun keys the balance by (WETH for
   *  native ETH). Compared case-insensitively against engine rows. */
  address: string;
  decimals: number;
}

/** Ordered token list per network — drives both the row order and the
 *  address→meta lookup. ETH first, then USDC. Addresses are lowercased so
 *  matching against engine rows is a plain string compare. */
export const RAILGUN_TOKENS: Record<RailgunNet, readonly TokenMeta[]> = {
  mainnet: [
    { symbol: 'ETH', address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', decimals: 18 },
    { symbol: 'USDC', address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', decimals: 6 },
  ],
  sepolia: [
    { symbol: 'ETH', address: '0xfff9976782d46cc05630d1f6ebab18b2324d6b14', decimals: 18 },
    { symbol: 'USDC', address: '0x1c7d4b196cb0c7b01d743fbc6116a902379c7238', decimals: 6 },
  ],
};
