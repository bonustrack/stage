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
    expect(
      walletAccountRows({
        label: 'Main',
        hdIndex: null,
        isSmart: false,
        rec: { type: 'seed' },
        activeSigner: '',
      }),
    ).toEqual([
      { label: 'Name', value: 'Main' },
      { label: 'Type', value: 'Legacy (seed)' },
    ]);
  });

  test('smart account with hd index and signer', () => {
    expect(
      walletAccountRows({
        label: 'Main',
        hdIndex: 0,
        isSmart: true,
        rec: { type: 'seed' },
        activeSigner: 'Recovery key',
      }),
    ).toEqual([
      { label: 'Name', value: 'Main' },
      { label: 'HD index', value: '#0' },
      { label: 'Type', value: 'Smart account (ZeroDev Kernel)' },
      { label: 'Active signer', value: 'Recovery key' },
    ]);
  });
});
