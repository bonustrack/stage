/** Tests for the anti-spoof confirm-summary derivation (audit HIGH/#1).
 *
 *  The confirm sheet for an in-chat payment request must be built from the
 *  ACTUAL broadcast bytes (call.to / call.data / call.value), never from the
 *  peer-supplied metadata. These tests pin that: a transfer's recipient/amount
 *  come from the decoded calldata, a native send from call.to/value, and an
 *  undecodable/unrecognised call yields an explicit `unverified` summary. */

import { describe, expect, test } from 'bun:test';
import { encodeFunctionData } from 'viem';
import { deriveConfirmSummary, confirmMessage } from '../lib/txConfirm';

const USDC_BASE = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
const RECIPIENT = '0x1111111111111111111111111111111111111111';
const ATTACKER = '0x2222222222222222222222222222222222222222';

const ERC20_ABI = [
  {
    type: 'function',
    name: 'transfer',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

function transferData(to: string, amount: bigint): string {
  return encodeFunctionData({ abi: ERC20_ABI, functionName: 'transfer', args: [to as `0x${string}`, amount] });
}

describe('deriveConfirmSummary - native send', () => {
  test('recipient = call.to, amount = call.value (wei), verified', () => {
    // 0.01 ETH = 10000000000000000 wei = 0x2386f26fc10000
    const s = deriveConfirmSummary({ to: RECIPIENT, value: '0x2386f26fc10000' });
    expect(s.verified).toBe(true);
    expect(s.recipient).toBe(RECIPIENT);
    expect(s.amount).toBe('0.01');
    expect(s.symbol).toBe('ETH');
  });
  test('uses the provided native symbol', () => {
    const s = deriveConfirmSummary({ to: RECIPIENT, value: '0x0' }, 'POL');
    expect(s.symbol).toBe('POL');
    expect(s.amount).toBe('0');
  });
});

describe('deriveConfirmSummary - ERC-20 transfer (anti-spoof core)', () => {
  test('known USDC: recipient + amount decoded from calldata, not metadata', () => {
    const s = deriveConfirmSummary({ to: USDC_BASE, value: '0x0', data: transferData(RECIPIENT, 10000n) });
    expect(s.verified).toBe(true);
    expect(s.recipient).toBe(RECIPIENT);
    expect(s.amount).toBe('0.01'); // 10000 atomic / 1e6
    expect(s.symbol).toBe('USDC');
  });

  test('SPOOF: calldata sends to attacker -> summary shows the ATTACKER, not the metadata recipient', () => {
    // A malicious request would display metadata.toAddress = friend while
    // call.data drains to the attacker. We only look at the bytes.
    const s = deriveConfirmSummary({ to: USDC_BASE, value: '0x0', data: transferData(ATTACKER, 999999999n) });
    expect(s.verified).toBe(true);
    expect(s.recipient).toBe(ATTACKER);
    expect(s.recipient).not.toBe(RECIPIENT);
  });

  test('unknown token: still verified, real recipient, atomic amount, no false symbol', () => {
    const unknown = '0x9999999999999999999999999999999999999999';
    const s = deriveConfirmSummary({ to: unknown, value: '0x0', data: transferData(RECIPIENT, 5n) });
    expect(s.verified).toBe(true);
    expect(s.recipient).toBe(RECIPIENT);
    expect(s.amount).toBe('5');
    expect(s.symbol).toBeUndefined();
    expect(s.target).toBe(unknown);
  });
});

describe('deriveConfirmSummary - unverified', () => {
  test('unrecognised method selector -> not verified, selector surfaced', () => {
    const s = deriveConfirmSummary({ to: USDC_BASE, value: '0x0', data: '0xdeadbeef0000' });
    expect(s.verified).toBe(false);
    expect(s.selector).toBe('0xdeadbeef');
    expect(s.target).toBe(USDC_BASE);
  });
  test('approve() (not transfer) is NOT shown as a friendly send', () => {
    const approveData = encodeFunctionData({
      abi: [{ type: 'function', name: 'approve', stateMutability: 'nonpayable', inputs: [{ name: 's', type: 'address' }, { name: 'a', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] }] as const,
      functionName: 'approve',
      args: [ATTACKER as `0x${string}`, (2n ** 256n) - 1n],
    });
    const s = deriveConfirmSummary({ to: USDC_BASE, value: '0x0', data: approveData });
    expect(s.verified).toBe(false);
  });
});

describe('confirmMessage', () => {
  test('verified transfer -> friendly send line', () => {
    const s = deriveConfirmSummary({ to: USDC_BASE, value: '0x0', data: transferData(RECIPIENT, 10000n) });
    const msg = confirmMessage(s, 'Base');
    expect(msg).toContain('0.01 USDC');
    expect(msg).toContain(RECIPIENT);
    expect(msg).toContain('Base');
  });
  test('unverified -> warning naming target + selector, never a friendly summary', () => {
    const s = deriveConfirmSummary({ to: USDC_BASE, value: '0x0', data: '0xdeadbeef0000' });
    const msg = confirmMessage(s, 'Base');
    expect(msg).toMatch(/unverified/i);
    expect(msg).toContain('0xdeadbeef');
    expect(msg).not.toMatch(/^Send /);
  });
});
