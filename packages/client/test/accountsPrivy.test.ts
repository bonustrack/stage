import { describe, expect, test } from 'bun:test';
import {
  derivedSignature,
  isPrivyLoginMethod,
  isUnlockSignature,
  privyAccountRecord,
  privyLoginOf,
  privyMethodName,
  privySignerKind,
  privyUnlockMessage,
} from '../src/accounts/privy';
import { ACCOUNT_TYPES } from '../src/accounts/types';

const ADDRESS = '0x52908400098527886E0F7030069857D2E4169EE7';
const UNLOCK = `0x${'ab'.repeat(65)}` as const;

describe('privy account records', () => {
  test('a sign-in becomes an account keyed by the wallet address', () => {
    const rec = privyAccountRecord(ADDRESS, 'google', 42);
    expect(rec).toEqual({
      id: ADDRESS.toLowerCase(),
      address: ADDRESS,
      type: 'privy',
      dbDir: `xmtp-${ADDRESS.toLowerCase()}`,
      registered: false,
      createdAt: 42,
      login: 'google',
    });
    expect(ACCOUNT_TYPES).toContain('privy');
  });

  test('a sign-in without a wallet address is refused', () => {
    expect(() => privyAccountRecord('not an address', 'wallet')).toThrow('wallet address');
  });

  test('a record without a method counts as a wallet sign-in', () => {
    const rec = privyAccountRecord(ADDRESS, 'microsoft');
    expect(privyLoginOf({ ...rec, login: undefined })).toBe('wallet');
    expect(privyLoginOf(rec)).toBe('microsoft');
  });
});

describe('privy methods', () => {
  test('only Google, Microsoft and wallet are sign-in methods', () => {
    expect(isPrivyLoginMethod('google')).toBe(true);
    expect(isPrivyLoginMethod('wallet')).toBe(true);
    expect(isPrivyLoginMethod('apple')).toBe(false);
    expect(isPrivyLoginMethod(undefined)).toBe(false);
  });

  test('social sign-ins use the embedded wallet, a web3 wallet signs itself', () => {
    expect(privySignerKind('google')).toBe('embedded');
    expect(privySignerKind('microsoft')).toBe('embedded');
    expect(privySignerKind('wallet')).toBe('external');
    expect(privyMethodName('microsoft')).toBe('Microsoft');
    expect(privyMethodName('github')).toBe('GitHub');
    expect(privySignerKind('github')).toBe('embedded');
    expect(isPrivyLoginMethod('github')).toBe(true);
  });
});

describe('unlock signature', () => {
  test('the unlock message names the account and where to sign it', () => {
    const message = privyUnlockMessage(ADDRESS);
    expect(message).toContain(ADDRESS.toLowerCase());
    expect(message).toContain('stage.box');
    expect(privyUnlockMessage(ADDRESS.toLowerCase())).toBe(message);
  });

  test('only a full signature unlocks', () => {
    expect(isUnlockSignature(UNLOCK)).toBe(true);
    expect(isUnlockSignature('0x1234')).toBe(false);
    expect(isUnlockSignature('zz')).toBe(false);
    expect(isUnlockSignature(null)).toBe(false);
  });

  test('derived signatures are stable per message and differ between messages and accounts', () => {
    const first = derivedSignature(UNLOCK, 'st.box mail key v1 for alice');
    expect(first).toBe(derivedSignature(UNLOCK, 'st.box mail key v1 for alice'));
    expect(first).not.toBe(derivedSignature(UNLOCK, 'st.box mail key v1 for bob'));
    expect(first).not.toBe(derivedSignature(`0x${'cd'.repeat(65)}`, 'st.box mail key v1 for alice'));
    expect(first).toMatch(/^0x[0-9a-f]{130}$/);
  });
});
