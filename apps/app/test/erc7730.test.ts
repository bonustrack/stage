/** ERC-7730 clear-signing enrichment (lib/erc7730). Pure + offline: exercises the
 *  bundled descriptor lookups + field formatting with NO network. */
import { describe, expect, test } from 'bun:test';
import {
  lookupDescriptor, lookupMessageDescriptor, formatField, knownAddressName,
} from '../lib/erc7730';

const MAX_UINT256 = ((1n << 256n) - 1n).toString();
const USDC = { chainId: 1, address: '0x', symbol: 'USDC', decimals: 6 };
const PERMIT2 = '0x000000000022D473030F116dDEE9F6B43aC78BA3';

describe('formatField', () => {
  test('tokenAmount uses the token decimals + symbol', () => {
    expect(formatField('5000000', 'tokenAmount', { token: USDC }))
      .toBe('5 USDC');
  });
  test('tokenAmount with no token -> 18 decimals, no symbol', () => {
    expect(formatField('1000000000000000000', 'tokenAmount')).toBe('1');
  });
  test('tokenAmount max-uint256 -> "Unlimited USDC"', () => {
    expect(formatField(MAX_UINT256, 'tokenAmount', { token: USDC })).toBe('Unlimited USDC');
  });
  test('tokenAmount near-max (2^255) -> Unlimited; no token -> bare "Unlimited"', () => {
    const nearMax = (1n << 255n).toString();
    expect(formatField(nearMax, 'tokenAmount', { token: USDC })).toBe('Unlimited USDC');
    expect(formatField(MAX_UINT256, 'tokenAmount')).toBe('Unlimited');
  });
  test('tokenAmount just under threshold -> normal number, not Unlimited', () => {
    const justUnder = ((1n << 255n) - 1n).toString();
    expect(formatField(justUnder, 'tokenAmount', { token: USDC })).not.toMatch(/Unlimited/);
  });
  test('addressName checksums an unknown address', () => {
    expect(formatField('0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', 'addressName'))
      .toBe('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48');
  });
  test('addressName labels a known address (Permit2)', () => {
    expect(formatField(PERMIT2, 'addressName')).toBe('Permit2 (0x0000…8BA3)');
  });
  test('date renders a UTC timestamp', () => {
    expect(formatField('1700000000', 'date')).toMatch(/2023-11-14 .* UTC/);
  });
  test('raw passes through; bad numeric falls back to raw', () => {
    expect(formatField('hello', 'raw')).toBe('hello');
    expect(formatField('notanumber', 'date')).toBe('notanumber');
  });
});

describe('knownAddressName', () => {
  test('Permit2 resolves (case-insensitive)', () => {
    expect(knownAddressName(PERMIT2)).toBe('Permit2');
    expect(knownAddressName(PERMIT2.toLowerCase())).toBe('Permit2');
  });
  test('unknown address -> undefined', () => {
    expect(knownAddressName('0x000000000000000000000000000000000000dead')).toBeUndefined();
    expect(knownAddressName(undefined)).toBeUndefined();
  });
});

describe('lookupDescriptor (calldata)', () => {
  test('ERC-20 transfer on USDC mainnet -> Send intent + Amount/To labels', () => {
    const m = lookupDescriptor({
      chainId: 1,
      address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      signature: 'transfer(address _to, uint256 _value)',
    });
    expect(m).not.toBeNull();
    expect(m!.intent).toBe('Send');
    expect(m!.fields.map(f => f.label)).toEqual(['Amount', 'To']);
    expect(m!.self?.symbol).toBe('USDC');
  });
  test('ERC-20 approve -> Approve intent', () => {
    const m = lookupDescriptor({
      chainId: 1,
      address: '0x6b175474e89094c44da98b954eedeac495271d0f',
      signature: 'approve(address spender, uint256 value)',
    });
    expect(m!.intent).toBe('Approve');
    expect(m!.fields[0].label).toBe('Spender');
  });
  test('unknown contract -> null (graceful fallback)', () => {
    expect(lookupDescriptor({
      chainId: 1, address: '0x000000000000000000000000000000000000dead',
      signature: 'transfer(address,uint256)',
    })).toBeNull();
  });
  test('known contract but unknown function -> null', () => {
    expect(lookupDescriptor({
      chainId: 1, address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      signature: 'frobnicate(uint256)',
    })).toBeNull();
  });
});

describe('lookupMessageDescriptor (EIP-712)', () => {
  test('Permit2 PermitSingle by domain + verifyingContract', () => {
    const m = lookupMessageDescriptor({
      primaryType: 'PermitSingle',
      domain: { name: 'Permit2', verifyingContract: '0x000000000022D473030F116dDEE9F6B43aC78BA3' },
    });
    expect(m).not.toBeNull();
    expect(m!.intent).toMatch(/Permit2/);
    expect(m!.fields.find(f => f.label === 'Spender')).toBeTruthy();
  });
  test('EIP-2612 Permit by primaryType alone', () => {
    const m = lookupMessageDescriptor({ primaryType: 'Permit', domain: { name: 'Dai Stablecoin' } });
    expect(m!.intent).toMatch(/spending/i);
  });
  test('unknown primaryType -> null', () => {
    expect(lookupMessageDescriptor({ primaryType: 'SomethingElse' })).toBeNull();
  });
});
