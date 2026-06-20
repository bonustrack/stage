import { NATIVE_TOKEN_SENTINEL } from '@stage-labs/client/wallet/assets';
import type { RailgunNet } from './networks';

export interface TokenMeta {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  logoAddress: string;
  logoChainId: number;
}

const ETH_SENTINEL = NATIVE_TOKEN_SENTINEL;
const USDC_MAINNET = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';

export const RAILGUN_TOKENS: Record<RailgunNet, readonly TokenMeta[]> = {
  mainnet: [
    { symbol: 'ETH', name: 'Ethereum', address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', decimals: 18, logoAddress: ETH_SENTINEL, logoChainId: 1 },
    { symbol: 'USDC', name: 'USD Coin', address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', decimals: 6, logoAddress: USDC_MAINNET, logoChainId: 1 },
  ],
  sepolia: [
    { symbol: 'ETH', name: 'Ethereum', address: '0xfff9976782d46cc05630d1f6ebab18b2324d6b14', decimals: 18, logoAddress: ETH_SENTINEL, logoChainId: 1 },
    { symbol: 'USDC', name: 'USD Coin', address: '0x1c7d4b196cb0c7b01d743fbc6116a902379c7238', decimals: 6, logoAddress: USDC_MAINNET, logoChainId: 1 },
  ],
};
