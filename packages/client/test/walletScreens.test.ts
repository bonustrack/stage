import { describe, expect, it } from 'bun:test';
import { receiveViewModel } from '../src/wallet/receive';
import { tokenDetailViewModel, tokenValueUsd } from '../src/wallet/tokenDetail';
import {
  parsePositiveAmount, tokenAmountFromInput, toggleAmountUnit, trimDecimalString,
} from '../src/wallet/sendAmount';

const PUB = '0x1111111111111111111111111111111111111111';
const ZK = '0zkprivateaddr';

describe('receiveViewModel', () => {
  it('public mode returns public address + labels', () => {
    const vm = receiveViewModel({ mode: 'public', publicAddress: PUB, privateAddress: ZK, privateReady: true });
    expect(vm.activeMode).toBe('public');
    expect(vm.address).toBe(PUB);
    expect(vm.label).toBe('Wallet address (tap to copy)');
    expect(vm.hint).toContain('Scan or share');
  });

  it('private mode when ready returns shielded address + labels', () => {
    const vm = receiveViewModel({ mode: 'private', publicAddress: PUB, privateAddress: ZK, privateReady: true });
    expect(vm.activeMode).toBe('private');
    expect(vm.address).toBe(ZK);
    expect(vm.label).toBe('Shielded 0zk address (tap to copy)');
    expect(vm.hint).toContain('Railgun');
  });

  it('private mode falls back to public when not ready', () => {
    const vm = receiveViewModel({ mode: 'private', publicAddress: PUB, privateAddress: '', privateReady: false });
    expect(vm.activeMode).toBe('public');
    expect(vm.address).toBe(PUB);
  });
});

describe('tokenValueUsd / tokenDetailViewModel', () => {
  it('null price yields null value and em-dash usd', () => {
    expect(tokenValueUsd({ priceUsd: null, balance: '5' })).toBeNull();
    const vm = tokenDetailViewModel(
      { name: 'Ethereum', symbol: 'ETH', chainId: 1, balance: '2', priceUsd: null },
      { networkLabels: { 1: 'Ethereum' } },
    );
    expect(vm.usdLabel).toBe('—');
    expect(vm.valueUsd).toBeNull();
  });

  it('computes value from price * balance and formats labels', () => {
    const vm = tokenDetailViewModel(
      { name: 'USD Coin', symbol: 'USDC', chainId: 1, balance: '10', priceUsd: 2 },
      { networkLabels: { 1: 'Ethereum' } },
    );
    expect(vm.valueUsd).toBe(20);
    expect(vm.balanceLabel).toBe('10 USDC');
    expect(vm.networkLabel).toBe('Ethereum');
  });

  it('falls back to Chain <id> for unknown chains', () => {
    const vm = tokenDetailViewModel(
      { name: 'Ethereum', symbol: 'ETH', chainId: 8453, balance: '1', priceUsd: 1 },
      { networkLabels: { 1: 'Ethereum', 11155111: 'Sepolia' } },
    );
    expect(vm.networkLabel).toBe('Chain 8453');
  });
});

describe('sendAmount', () => {
  it('parsePositiveAmount guards empty / non-finite / non-positive', () => {
    expect(parsePositiveAmount('')).toBeNull();
    expect(parsePositiveAmount('  ')).toBeNull();
    expect(parsePositiveAmount('abc')).toBeNull();
    expect(parsePositiveAmount('0')).toBeNull();
    expect(parsePositiveAmount('-1')).toBeNull();
    expect(parsePositiveAmount('1.5')).toBe(1.5);
  });

  it('tokenAmountFromInput converts only in usd unit with price', () => {
    expect(tokenAmountFromInput('2', 'primary', 100)).toBe(2);
    expect(tokenAmountFromInput('200', 'usd', 100)).toBe(2);
    expect(tokenAmountFromInput('200', 'usd', null)).toBe(0);
    expect(tokenAmountFromInput('', 'usd', 100)).toBe(0);
  });

  it('toggleAmountUnit flips unit only when amount/price missing', () => {
    expect(toggleAmountUnit('', 'primary', 100)).toEqual({ amount: '', unit: 'usd' });
    expect(toggleAmountUnit('1', 'primary', null)).toEqual({ amount: '1', unit: 'usd' });
    expect(toggleAmountUnit('0', 'usd', 100)).toEqual({ amount: '0', unit: 'primary' });
  });

  it('toggleAmountUnit converts primary->usd with toFixed(2)', () => {
    expect(toggleAmountUnit('2', 'primary', 1234.5)).toEqual({ amount: '2469.00', unit: 'usd' });
  });

  it('toggleAmountUnit converts usd->primary trimming trailing zeros', () => {
    expect(toggleAmountUnit('100', 'usd', 4)).toEqual({ amount: '25', unit: 'primary' });
    expect(toggleAmountUnit('1', 'usd', 3)).toEqual({ amount: '0.333333', unit: 'primary' });
  });

  it('trimDecimalString strips trailing zeros and dot', () => {
    expect(trimDecimalString('0.250000')).toBe('0.25');
    expect(trimDecimalString('5.000000')).toBe('5');
    expect(trimDecimalString('5')).toBe('5');
  });
});
