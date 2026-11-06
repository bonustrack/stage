import { describe, expect, test } from 'bun:test';
import { walletAccountRows, walletDeployLabel } from '../components/settings/WalletSettings.model';

describe('walletDeployLabel', () => {
  test('maps every deploy state to its label', () => {
    expect(walletDeployLabel('loading')).toBe('Checking…');
    expect(walletDeployLabel('deployed')).toBe('Deployed on-chain');
    expect(walletDeployLabel('counterfactual')).toBe('Counterfactual (not yet deployed)');
    expect(walletDeployLabel('unknown')).toBe('Unknown');
  });
});

describe('walletAccountRows', () => {
  test('legacy account', () => {
    expect(walletAccountRows({ label: 'Main', type: 'privateKey' })).toEqual([
      { label: 'Name', value: 'Main' },
      { label: 'Type', value: 'Legacy (privateKey)' },
    ]);
  });

  test('an account without a label is named Account', () => {
    expect(walletAccountRows({ type: 'generated' })[0]).toEqual({ label: 'Name', value: 'Account' });
  });

  test('smart account with hd index and signer', () => {
    expect(walletAccountRows({ label: 'Main', hdIndex: 0, type: 'smart' })).toEqual([
      { label: 'Name', value: 'Main' },
      { label: 'HD index', value: '#0' },
      { label: 'Type', value: 'Smart account (ZeroDev Kernel)' },
      { label: 'Active signer', value: 'Recovery key' },
    ]);
  });
});
