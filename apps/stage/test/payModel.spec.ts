import { describe, expect, test } from 'bun:test';
import { paymentBlocker } from '../components/conversation/pay.model';

const BASE = 8453;

describe('paymentBlocker', () => {
  test('a smart account refuses to pay on any chain but Base instead of rerouting', () => {
    expect(paymentBlocker({ callCount: 1, chainId: 1, chainName: 'Ethereum', smartAccount: true }))
      .toBe('This payment is on Ethereum. Your Stage wallet pays on Base only.');
    expect(paymentBlocker({ callCount: 1, chainId: BASE, chainName: 'Base', smartAccount: true })).toBeNull();
  });

  test('a key-based account pays on the chain the request names', () => {
    expect(paymentBlocker({ callCount: 1, chainId: 1, chainName: 'Ethereum', smartAccount: false })).toBeNull();
  });

  test('a multi-step request is refused rather than paying only its first step', () => {
    expect(paymentBlocker({ callCount: 2, chainId: BASE, chainName: 'Base', smartAccount: true })).toMatch(/several steps/);
    expect(paymentBlocker({ callCount: 0, chainId: BASE, chainName: 'Base', smartAccount: false })).toMatch(/several steps/);
  });
});
