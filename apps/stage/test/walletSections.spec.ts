import { describe, expect, test } from 'bun:test';
import {
  WALLET_ROLE_BADGE,
  walletAccountRows,
  walletDeployLabel,
  walletManageItems,
} from '../components/settings/WalletSettings.model';

describe('walletDeployLabel', () => {
  test('maps every deploy state to its label', () => {
    expect(walletDeployLabel('loading')).toBe('Checking…');
    expect(walletDeployLabel('deployed')).toBe('Deployed on-chain');
    expect(walletDeployLabel('counterfactual')).toBe('Counterfactual (not yet deployed)');
    expect(walletDeployLabel('unknown')).toBe('Unknown');
  });
});

describe('WALLET_ROLE_BADGE', () => {
  test('maps roles to badge colors', () => {
    expect(WALLET_ROLE_BADGE).toEqual({
      sudo: 'success', backup: 'secondary', recovery: 'info', session: 'secondary',
    });
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
        activeSigner: 'passkey',
      }),
    ).toEqual([
      { label: 'Name', value: 'Main' },
      { label: 'HD index', value: '#0' },
      { label: 'Type', value: 'Smart account (ZeroDev Kernel)' },
      { label: 'Active signer', value: 'passkey' },
    ]);
  });
});

describe('walletManageItems', () => {
  test('minimal (recovery row only)', () => {
    expect(
      walletManageItems(
        { available: false, busy: false },
        { available: false, busy: false },
        undefined,
      ),
    ).toEqual([
      { icon: 'userGroup', label: 'Set up recovery & backup phrase', action: 'recovery' },
    ]);
  });

  test('full (busy passkey, removable, guardians set)', () => {
    expect(
      walletManageItems(
        { available: true, busy: true },
        { available: true, busy: false },
        2,
      ),
    ).toEqual([
      { icon: 'fingerPrint', label: 'Enabling passkey…', action: 'passkey' },
      { icon: 'fingerPrint', label: 'Remove passkey', action: 'removePasskey' },
      { icon: 'userGroup', label: 'Guardian recovery & backup phrase', action: 'recovery' },
    ]);
  });
});
