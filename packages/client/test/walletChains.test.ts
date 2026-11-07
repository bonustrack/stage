import { describe, expect, test } from 'bun:test';
import { KNOWN_TOKENS } from '../src/wallet/assets';
import { explorerUrl, isWalletChain, networkLogo, MAINNET_NETWORK_LOGO, viemChainName, x402Network } from '../src/wallet/chains';

describe('chain table', () => {
  test('names the chains the app has a client for, and only those', () => {
    expect(viemChainName(8453)).toBe('Base');
    expect(viemChainName(1)).toBe('Ethereum');
    expect(viemChainName(11155111)).toBe('Sepolia');
    expect(viemChainName(10)).toBeUndefined();
    expect(viemChainName(84532)).toBeUndefined();
  });

  test('the Stage wallet pays on Base only', () => {
    expect(isWalletChain(8453)).toBe(true);
    expect(isWalletChain(1)).toBe(false);
  });

  test('explorers fall back to Etherscan', () => {
    expect(explorerUrl(8453)).toBe('https://basescan.org');
    expect(explorerUrl(10)).toBe('https://optimistic.etherscan.io');
    expect(explorerUrl(43114)).toBe('https://etherscan.io');
    expect(explorerUrl(999)).toBe('https://etherscan.io');
  });

  test('x402 network names map to a chain and its label', () => {
    expect(x402Network(' Base ')).toEqual({ chainId: 8453, label: 'Base' });
    expect(x402Network('eip155:42161')).toEqual({ chainId: 42161, label: 'Arbitrum' });
    expect(x402Network('eip155:999')).toBeUndefined();
  });

  test('unknown chains get the mainnet badge', () => {
    expect(networkLogo(999)).toBe(MAINNET_NETWORK_LOGO);
  });
});

describe('KNOWN_TOKENS', () => {
  test('lists USDC deployments only, keyed by lowercase address', () => {
    expect(Object.keys(KNOWN_TOKENS).every((address) => address === address.toLowerCase())).toBe(true);
    expect(Object.values(KNOWN_TOKENS).every((t) => t.symbol === 'USDC' && t.decimals === 6)).toBe(true);
    expect(KNOWN_TOKENS['0x833589fcd6edb6e08f4c7c32d4f71b54bda02913']).toEqual({ symbol: 'USDC', decimals: 6 });
  });
});
