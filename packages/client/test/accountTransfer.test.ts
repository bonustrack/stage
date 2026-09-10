import { describe, expect, test } from 'bun:test';
import { decodeAccountTransfer, encodeAccountTransfer } from '../src/accounts/transfer';
import { generateWalletMnemonic } from '../src/zerodev/derive';

const PK = '0x4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318';

describe('account transfer codec', () => {
  test('round-trips a private key', () => {
    const encoded = encodeAccountTransfer({ kind: 'pk', pk: PK });
    expect(encoded.startsWith('stage-account:1:pk:')).toBe(true);
    expect(decodeAccountTransfer(encoded)).toEqual({ kind: 'pk', pk: PK });
  });

  test('round-trips a recovery phrase', () => {
    const phrase = generateWalletMnemonic();
    const encoded = encodeAccountTransfer({ kind: 'phrase', phrase });
    expect(encoded.includes(' ')).toBe(false);
    expect(decodeAccountTransfer(encoded)).toEqual({ kind: 'phrase', phrase });
  });

  test('accepts a raw private key with or without the 0x prefix', () => {
    expect(decodeAccountTransfer(PK.slice(2).toUpperCase())).toEqual({ kind: 'pk', pk: PK });
    expect(decodeAccountTransfer(`  ${PK}\n`)).toEqual({ kind: 'pk', pk: PK });
  });

  test('accepts a raw recovery phrase', () => {
    const phrase = generateWalletMnemonic();
    expect(decodeAccountTransfer(`  ${phrase.toUpperCase()}  `)).toEqual({ kind: 'phrase', phrase });
  });

  test('rejects garbage and unknown tags', () => {
    expect(decodeAccountTransfer('')).toBeNull();
    expect(decodeAccountTransfer('hello world')).toBeNull();
    expect(decodeAccountTransfer('0x1234')).toBeNull();
    expect(decodeAccountTransfer('stage-account:1:seed:abc')).toBeNull();
    expect(decodeAccountTransfer('stage-account:1:pk:0x1234')).toBeNull();
  });
});
